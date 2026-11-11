using Microsoft.EntityFrameworkCore;
using SchoolAdmission.Api.Api;
using SchoolAdmission.Api.Data;

namespace SchoolAdmission.Api.Services;

public interface IClassService
{
    Task<ServiceResult> CreateAsync(string? name, int? totalSeats);
    Task<ServiceResult> ListAsync();
    Task<ServiceResult> GetAsync(string classId);
}

public class ClassService : IClassService
{
    private const int MaxSeats = 100;
    private readonly AdmissionDbContext _db;

    public ClassService(AdmissionDbContext db) => _db = db;

    public async Task<ServiceResult> CreateAsync(string? name, int? totalSeats)
    {
        var trimmed = name?.Trim();
        if (string.IsNullOrEmpty(trimmed) || trimmed.Length > 200)
            return ServiceResult.Fail(400, "invalid_name",
                "Please enter a class name (up to 200 characters).");

        if (totalSeats is null || totalSeats < 1 || totalSeats > MaxSeats)
            return ServiceResult.Fail(400, "invalid_total_seats",
                $"Seat count must be a whole number between 1 and {MaxSeats}.");

        var entity = new SchoolClass
        {
            Id = "c_" + Guid.NewGuid().ToString("N"),
            Name = trimmed,
            TotalSeats = totalSeats.Value,
            CreatedAt = DateTime.UtcNow
        };
        _db.Classes.Add(entity);
        await _db.SaveChangesAsync();

        return ServiceResult.Ok(
            new { id = entity.Id, name = entity.Name, totalSeats = entity.TotalSeats }, 201);
    }

    public async Task<ServiceResult> ListAsync() =>
        ServiceResult.Ok(await QueryClasses(null));

    public async Task<ServiceResult> GetAsync(string classId)
    {
        var found = (await QueryClasses(classId)).FirstOrDefault();
        return found is null
            ? ServiceResult.Fail(404, "class_not_found", "This class does not exist.")
            : ServiceResult.Ok(found);
    }

    // Seat counts are always derived from the holds table (no stored counters).
    // A HELD row only counts while expiresAt is in the future.
    private async Task<List<ClassResponse>> QueryClasses(string? classId)
    {
        var now = DateTime.UtcNow;

        var query = _db.Classes.AsNoTracking();
        if (classId is not null) query = query.Where(c => c.Id == classId);

        var rows = await query
            .OrderBy(c => c.CreatedAt)
            .Select(c => new
            {
                c.Id,
                c.Name,
                c.TotalSeats,
                Held = _db.Holds.Count(h => h.ClassId == c.Id
                    && h.Status == HoldStatus.HELD && h.ExpiresAt > now),
                Confirmed = _db.Holds.Count(h => h.ClassId == c.Id
                    && h.Status == HoldStatus.CONFIRMED)
            })
            .ToListAsync();

        return rows.Select(r => new ClassResponse(
            r.Id, r.Name, r.TotalSeats, r.Held, r.Confirmed,
            Math.Max(0, r.TotalSeats - r.Held - r.Confirmed))).ToList();
    }
}