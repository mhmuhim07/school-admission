using Microsoft.EntityFrameworkCore;
using Npgsql;
using SchoolAdmission.Api.Api;
using SchoolAdmission.Api.Data;

namespace SchoolAdmission.Api.Endpoints;

public static class HoldEndpoints
{
    public static void MapHoldEndpoints(this WebApplication app)
    {
        // 4. POST /classes/{classId}/holds
        app.MapPost("/classes/{classId}/holds", async (
            string classId, HttpRequest request, AdmissionDbContext db, HoldSettings settings) =>
        {
            if (!StudentHeader.TryGet(request, out var studentId))
                return StudentHeader.Invalid();

            try
            {
                await using var tx = await db.Database.BeginTransactionAsync();

                // 1. Lock the class row. Other requests for this class wait here.
                var lockedClasses = await db.Classes
                    .FromSqlInterpolated($"SELECT * FROM classes WHERE \"Id\" = {classId} FOR UPDATE")
                    .AsNoTracking()
                    .ToListAsync();
                var cls = lockedClasses.FirstOrDefault();
                if (cls is null)
                    return ApiErrors.Error(404, "class_not_found", "This class does not exist.");

                var now = DateTime.UtcNow;

                // 2. This student's stale HELD rows in this class become EXPIRED,
                //    so they cannot block the unique index.
                await db.Holds
                    .Where(h => h.ClassId == classId && h.StudentId == studentId
                        && h.Status == HoldStatus.HELD && h.ExpiresAt <= now)
                    .ExecuteUpdateAsync(s => s.SetProperty(h => h.Status, HoldStatus.EXPIRED));

                // 3. One active application per student per class
                var alreadyActive = await db.Holds.AnyAsync(h =>
                    h.ClassId == classId && h.StudentId == studentId
                    && (h.Status == HoldStatus.CONFIRMED
                        || (h.Status == HoldStatus.HELD && h.ExpiresAt > now)));
                if (alreadyActive)
                    return ApiErrors.Error(409, "already_applied",
                        "You already have an application for this class.");

                // 4. Seats: unexpired HELD + CONFIRMED must stay below totalSeats
                var taken = await db.Holds.CountAsync(h => h.ClassId == classId
                    && (h.Status == HoldStatus.CONFIRMED
                        || (h.Status == HoldStatus.HELD && h.ExpiresAt > now)));
                if (taken >= cls.TotalSeats)
                    return ApiErrors.Error(409, "class_full",
                        "Sorry, all seats in this class are taken right now. Please try again later.");

                // 5. Create the hold
                var hold = new Hold
                {
                    Id = "h_" + Guid.NewGuid().ToString("N"),
                    ClassId = classId,
                    StudentId = studentId,
                    Status = HoldStatus.HELD,
                    CreatedAt = now,
                    ExpiresAt = now + settings.Duration
                };
                db.Holds.Add(hold);
                await db.SaveChangesAsync();
                await tx.CommitAsync();

                return Results.Json(new
                {
                    holdId = hold.Id,
                    classId = hold.ClassId,
                    studentId = hold.StudentId,
                    status = hold.Status.ToString(),
                    expiresAt = hold.ExpiresAt
                }, statusCode: 201);
            }
            catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: "23505" })
            {
                // The unique index caught a duplicate that slipped past the checks.
                return ApiErrors.Error(409, "already_applied",
                    "You already have an application for this class.");
            }
        });

        // 5. GET /holds/{holdId}
        app.MapGet("/holds/{holdId}", async (string holdId, AdmissionDbContext db) =>
        {
            var hold = await db.Holds.AsNoTracking().FirstOrDefaultAsync(h => h.Id == holdId);
            if (hold is null)
                return ApiErrors.Error(404, "hold_not_found", "This application does not exist.");

            var now = DateTime.UtcNow;
            return Results.Ok(new
            {
                holdId = hold.Id,
                classId = hold.ClassId,
                status = EffectiveStatus(hold, now),
                expiresAt = hold.ExpiresAt,
                serverTime = now
            });
        });

        // 6. POST /holds/{holdId}/confirm
        app.MapPost("/holds/{holdId}/confirm", async (string holdId, HttpRequest request, AdmissionDbContext db) =>
        {
            if (!StudentHeader.TryGet(request, out var studentId))
                return StudentHeader.Invalid();

            await using var tx = await db.Database.BeginTransactionAsync();

            var hold = await LockHold(db, holdId);
            if (hold is null)
                return ApiErrors.Error(404, "hold_not_found", "This application does not exist.");
            if (hold.StudentId != studentId)
                return ApiErrors.Error(403, "not_your_application", "This application belongs to another student.");

            var now = DateTime.UtcNow;

            if (hold.Status == HoldStatus.CONFIRMED)
                return Results.Ok(new { holdId = hold.Id, status = "CONFIRMED" });   // idempotent

            if (hold.Status == HoldStatus.CANCELLED)
                return ApiErrors.Error(409, "hold_cancelled", "This application was cancelled.");

            if (hold.Status == HoldStatus.HELD && hold.ExpiresAt > now)
            {
                hold.Status = HoldStatus.CONFIRMED;
                hold.ConfirmedAt = now;
                await db.SaveChangesAsync();
                await tx.CommitAsync();
                return Results.Ok(new { holdId = hold.Id, status = "CONFIRMED" });
            }

            // HELD but past its time, or already EXPIRED
            if (hold.Status == HoldStatus.HELD)
            {
                hold.Status = HoldStatus.EXPIRED;
                await db.SaveChangesAsync();
                await tx.CommitAsync();
            }
            return ApiErrors.Error(409, "hold_expired",
                "Your seat reservation has expired. Please apply again.");
        });

        // 7. DELETE /holds/{holdId}
        app.MapDelete("/holds/{holdId}", async (string holdId, HttpRequest request, AdmissionDbContext db) =>
        {
            if (!StudentHeader.TryGet(request, out var studentId))
                return StudentHeader.Invalid();

            await using var tx = await db.Database.BeginTransactionAsync();

            var hold = await LockHold(db, holdId);
            if (hold is null)
                return ApiErrors.Error(404, "hold_not_found", "This application does not exist.");
            if (hold.StudentId != studentId)
                return ApiErrors.Error(403, "not_your_application", "This application belongs to another student.");

            var now = DateTime.UtcNow;

            if (hold.Status == HoldStatus.CANCELLED)
                return Results.NoContent();                                          // already cancelled

            if (hold.Status == HoldStatus.CONFIRMED)
                return ApiErrors.Error(409, "cannot_cancel_confirmed",
                    "This admission is already confirmed and cannot be cancelled here.");

            if (hold.Status == HoldStatus.HELD && hold.ExpiresAt > now)
            {
                hold.Status = HoldStatus.CANCELLED;
                await db.SaveChangesAsync();
                await tx.CommitAsync();
                return Results.NoContent();
            }

            if (hold.Status == HoldStatus.HELD)
            {
                hold.Status = HoldStatus.EXPIRED;
                await db.SaveChangesAsync();
                await tx.CommitAsync();
            }
            return ApiErrors.Error(409, "hold_expired", "This application has already expired.");
        });

                // 8. GET /me/holds
        app.MapGet("/me/holds", async (HttpRequest request, AdmissionDbContext db) =>
        {
            if (!StudentHeader.TryGet(request, out var studentId))
                return StudentHeader.Invalid();

            var rows = await db.Holds
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
            return Results.Ok(rows.Select(r => new
            {
                holdId = r.Id,
                classId = r.ClassId,
                className = r.ClassName,
                status = EffectiveStatus(r.Status, r.ExpiresAt, now),
                expiresAt = r.ExpiresAt,
                serverTime = now
            }));
        });
    }
        // A HELD row past its expiry is reported as EXPIRED right away.
    private static string EffectiveStatus(Hold hold, DateTime now) =>
        hold.Status == HoldStatus.HELD && hold.ExpiresAt <= now
            ? "EXPIRED"
            : hold.Status.ToString();

    
    private static string EffectiveStatus(HoldStatus status, DateTime expiresAt, DateTime now) =>
        status == HoldStatus.HELD && expiresAt <= now
            ? "EXPIRED"
            : status.ToString();
    // Locks one hold row until the surrounding transaction ends.
    private static async Task<Hold?> LockHold(AdmissionDbContext db, string holdId) =>
        (await db.Holds
            .FromSqlInterpolated($"SELECT * FROM holds WHERE \"Id\" = {holdId} FOR UPDATE")
            .ToListAsync())
        .FirstOrDefault();
}