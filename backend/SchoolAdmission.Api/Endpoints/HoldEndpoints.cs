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
    }
}