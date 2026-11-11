using Microsoft.EntityFrameworkCore;
using Npgsql;
using SchoolAdmission.Api.Data;

namespace SchoolAdmission.Api.Services;

public interface IHoldService
{
    Task<ServiceResult> CreateHoldAsync(string classId, string studentId);
    Task<ServiceResult> GetHoldAsync(string holdId);
    Task<ServiceResult> ConfirmAsync(string holdId, string studentId);
    Task<ServiceResult> CancelAsync(string holdId, string studentId);
    Task<ServiceResult> ListForStudentAsync(string studentId);
}

public class HoldService : IHoldService
{
    private readonly AdmissionDbContext _db;
    private readonly HoldSettings _settings;

    public HoldService(AdmissionDbContext db, HoldSettings settings)
    {
        _db = db;
        _settings = settings;
    }

    // 4. Apply for a seat
    public async Task<ServiceResult> CreateHoldAsync(string classId, string studentId)
    {
        try
        {
            await using var tx = await _db.Database.BeginTransactionAsync();

            // 1. Lock the class row. Other requests for this class wait here.
            var lockedClasses = await _db.Classes
                .FromSqlInterpolated($"SELECT * FROM classes WHERE \"Id\" = {classId} FOR UPDATE")
                .AsNoTracking()
                .ToListAsync();
            var cls = lockedClasses.FirstOrDefault();
            if (cls is null)
                return ServiceResult.Fail(404, "class_not_found", "This class does not exist.");

            var now = DateTime.UtcNow;

            // 2. This student's stale HELD rows in this class become EXPIRED.
            await _db.Holds
                .Where(h => h.ClassId == classId && h.StudentId == studentId
                    && h.Status == HoldStatus.HELD && h.ExpiresAt <= now)
                .ExecuteUpdateAsync(s => s.SetProperty(h => h.Status, HoldStatus.EXPIRED));

            // 3. One active application per student per class
            var alreadyActive = await _db.Holds.AnyAsync(h =>
                h.ClassId == classId && h.StudentId == studentId
                && (h.Status == HoldStatus.CONFIRMED
                    || (h.Status == HoldStatus.HELD && h.ExpiresAt > now)));
            if (alreadyActive)
                return ServiceResult.Fail(409, "already_applied",
                    "You already have an application for this class.");

            // 4. Seats: unexpired HELD + CONFIRMED must stay below totalSeats
            var taken = await _db.Holds.CountAsync(h => h.ClassId == classId
                && (h.Status == HoldStatus.CONFIRMED
                    || (h.Status == HoldStatus.HELD && h.ExpiresAt > now)));
            if (taken >= cls.TotalSeats)
                return ServiceResult.Fail(409, "class_full",
                    "Sorry, all seats in this class are taken right now. Please try again later.");

            // 5. Create the hold
            var hold = new Hold
            {
                Id = "h_" + Guid.NewGuid().ToString("N"),
                ClassId = classId,
                StudentId = studentId,
                Status = HoldStatus.HELD,
                CreatedAt = now,
                ExpiresAt = now + _settings.Duration
            };
            _db.Holds.Add(hold);
            await _db.SaveChangesAsync();
            await tx.CommitAsync();

            return ServiceResult.Ok(new
            {
                holdId = hold.Id,
                classId = hold.ClassId,
                studentId = hold.StudentId,
                status = hold.Status.ToString(),
                expiresAt = hold.ExpiresAt
            }, 201);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: "23505" })
        {
            return ServiceResult.Fail(409, "already_applied",
                "You already have an application for this class.");
        }
    }

    // 5. Current status of an application
    public async Task<ServiceResult> GetHoldAsync(string holdId)
    {
        var hold = await _db.Holds.AsNoTracking().FirstOrDefaultAsync(h => h.Id == holdId);
        if (hold is null)
            return ServiceResult.Fail(404, "hold_not_found", "This application does not exist.");

        var now = DateTime.UtcNow;
        return ServiceResult.Ok(new
        {
            holdId = hold.Id,
            classId = hold.ClassId,
            status = EffectiveStatus(hold.Status, hold.ExpiresAt, now),
            expiresAt = hold.ExpiresAt,
            serverTime = now
        });
    }

    // 6. Pay the fee (idempotent)
    public async Task<ServiceResult> ConfirmAsync(string holdId, string studentId)
    {
        await using var tx = await _db.Database.BeginTransactionAsync();

        var hold = await LockHold(holdId);
        if (hold is null)
            return ServiceResult.Fail(404, "hold_not_found", "This application does not exist.");
        if (hold.StudentId != studentId)
            return ServiceResult.Fail(403, "not_your_application", "This application belongs to another student.");

        var now = DateTime.UtcNow;

        if (hold.Status == HoldStatus.CONFIRMED)
            return ServiceResult.Ok(new { holdId = hold.Id, status = "CONFIRMED" });

        if (hold.Status == HoldStatus.CANCELLED)
            return ServiceResult.Fail(409, "hold_cancelled", "This application was cancelled.");

        if (hold.Status == HoldStatus.HELD && hold.ExpiresAt > now)
        {
            hold.Status = HoldStatus.CONFIRMED;
            hold.ConfirmedAt = now;
            await _db.SaveChangesAsync();
            await tx.CommitAsync();
            return ServiceResult.Ok(new { holdId = hold.Id, status = "CONFIRMED" });
        }

        if (hold.Status == HoldStatus.HELD)
        {
            hold.Status = HoldStatus.EXPIRED;
            await _db.SaveChangesAsync();
            await tx.CommitAsync();
        }
        return ServiceResult.Fail(409, "hold_expired",
            "Your seat reservation has expired. Please apply again.");
    }

    // 7. Cancel
    public async Task<ServiceResult> CancelAsync(string holdId, string studentId)
    {
        await using var tx = await _db.Database.BeginTransactionAsync();

        var hold = await LockHold(holdId);
        if (hold is null)
            return ServiceResult.Fail(404, "hold_not_found", "This application does not exist.");
        if (hold.StudentId != studentId)
            return ServiceResult.Fail(403, "not_your_application", "This application belongs to another student.");

        var now = DateTime.UtcNow;

        if (hold.Status == HoldStatus.CANCELLED)
            return ServiceResult.NoContent();

        if (hold.Status == HoldStatus.CONFIRMED)
            return ServiceResult.Fail(409, "cannot_cancel_confirmed",
                "This admission is already confirmed and cannot be cancelled here.");

        if (hold.Status == HoldStatus.HELD && hold.ExpiresAt > now)
        {
            hold.Status = HoldStatus.CANCELLED;
            await _db.SaveChangesAsync();
            await tx.CommitAsync();
            return ServiceResult.NoContent();
        }

        if (hold.Status == HoldStatus.HELD)
        {
            hold.Status = HoldStatus.EXPIRED;
            await _db.SaveChangesAsync();
            await tx.CommitAsync();
        }
        return ServiceResult.Fail(409, "hold_expired", "This application has already expired.");
    }

    // 8. All applications of one student
    public async Task<ServiceResult> ListForStudentAsync(string studentId)
    {
        var rows = await _db.Holds
            .AsNoTracking()
            .Where(h => h.StudentId == studentId)
            .OrderByDescending(h => h.CreatedAt)
            .Select(h => new
            {
                h.Id,
                h.ClassId,
                ClassName = h.Class!.Name,
                h.Status,
                h.ExpiresAt
            })
            .ToListAsync();

        var now = DateTime.UtcNow;
        return ServiceResult.Ok(rows.Select(r => new
        {
            holdId = r.Id,
            classId = r.ClassId,
            className = r.ClassName,
            status = EffectiveStatus(r.Status, r.ExpiresAt, now),
            expiresAt = r.ExpiresAt,
            serverTime = now
        }).ToList());
    }

    // A HELD row past its expiry is reported as EXPIRED right away.
    private static string EffectiveStatus(HoldStatus status, DateTime expiresAt, DateTime now) =>
        status == HoldStatus.HELD && expiresAt <= now ? "EXPIRED" : status.ToString();

    // Locks one hold row until the surrounding transaction ends.
    private async Task<Hold?> LockHold(string holdId) =>
        (await _db.Holds
            .FromSqlInterpolated($"SELECT * FROM holds WHERE \"Id\" = {holdId} FOR UPDATE")
            .ToListAsync())
        .FirstOrDefault();
}