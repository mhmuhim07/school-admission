using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SchoolAdmission.Api.Api;
using SchoolAdmission.Api.Data;

namespace SchoolAdmission.Api.Endpoints;

public static class ClassEndpoints
{
    private const int MaxSeats = 100;
    public static void MapClassEndpoints(this WebApplication app)
    {
        var Classes = app.MapGroup("/classes");
        // GET /classes
        Classes.MapGet("/", async (AdmissionDbContext db) =>
            Results.Ok(await QueryClasses(db,null))
        );

        // GET /classes/{classId}
        Classes.MapGet("/{classId}", async (string classId, AdmissionDbContext db) =>
        {
            var found = (await QueryClasses(db, classId)).FirstOrDefault();
            return found is null
                ? ApiErrors.Error(404, "class_not_found", "This class does not exist.")
                : Results.Ok(found);
        });

        //POST /classes
        Classes.MapPost("/", async(HttpRequest request, AdmissionDbContext db) =>
        {
            CreateClassRequest? body;
            try
            {
                body = await request.ReadFromJsonAsync<CreateClassRequest>();

            }
            catch (Exception ex) when (ex is JsonException or InvalidOperationException)
            {
                return ApiErrors.Error(400, "invalid_request",
                    "Please send a class name and a whole number of seats.");
            }
            var name = body?.Name?.Trim();
            if (string.IsNullOrEmpty(name) || name.Length > 200)
                return ApiErrors.Error(400, "invalid_name",
                    "Please enter a class name (up to 200 characters).");
            
             if (body?.TotalSeats is null || body.TotalSeats < 1 || body.TotalSeats > MaxSeats)
                return ApiErrors.Error(400, "invalid_total_seats",
                    $"Seat count must be a whole number between 1 and {MaxSeats}.");

            var entity = new SchoolClass
            {
                Id = "C_"+ Guid.NewGuid().ToString("N"),
                Name = name,
                TotalSeats = body.TotalSeats.Value,
                CreatedAt = DateTime.UtcNow
            };
            db.Classes.Add(entity);
            await db.SaveChangesAsync();
            return Results.Created($"/classes/{entity.Id}",
                new {id = entity.Id, name = entity.Name, totalSeats = entity.TotalSeats}
            );
        });
    }
    private static async Task<List<ClassResponse>> QueryClasses(AdmissionDbContext db, string? classId)
    {
        var now = DateTime.UtcNow;

        var query = db.Classes.AsNoTracking();
        if (classId is not null) query = query.Where(c => c.Id == classId);

        var rows = await query
            .OrderBy(c => c.CreatedAt)
            .Select(c => new
            {
                c.Id,
                c.Name,
                c.TotalSeats,
                Held = db.Holds.Count(h => h.ClassId == c.Id
                    && h.Status == HoldStatus.HELD && h.ExpiresAt > now),
                Confirmed = db.Holds.Count(h => h.ClassId == c.Id
                    && h.Status == HoldStatus.CONFIRMED)
            })
            .ToListAsync();

        return rows.Select(r => new ClassResponse(
            r.Id, r.Name, r.TotalSeats, r.Held, r.Confirmed,
            Math.Max(0, r.TotalSeats - r.Held - r.Confirmed))).ToList();
    }
}