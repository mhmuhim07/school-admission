using Microsoft.EntityFrameworkCore;
using SchoolAdmission.Api.Data;

namespace SchoolAdmission.Api.BackgroundJobs;

// Tidies up stored data: marks HELD rows whose time has passed as EXPIRED.
// Seat counts never depend on this job; they use "expiresAt > now" directly.
public class HoldExpiryWorker(IServiceScopeFactory scopes, ILogger<HoldExpiryWorker> log) : BackgroundService
{
    private readonly IServiceScopeFactory _scopes = scopes;
    private readonly ILogger<HoldExpiryWorker> _log = log;

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(5));
        try
        {
            while (await timer.WaitForNextTickAsync(ct))
            {
                try
                {
                    using var scope = _scopes.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<AdmissionDbContext>();
                    var now = DateTime.UtcNow;

                    var changed = await db.Holds
                        .Where(h => h.Status == HoldStatus.HELD && h.ExpiresAt <= now)
                        .ExecuteUpdateAsync(s => s.SetProperty(h => h.Status, HoldStatus.EXPIRED), ct);

                    if (changed > 0)
                        _log.LogInformation("Marked {Count} expired hold(s).", changed);
                }
                catch (Exception ex) when (!ct.IsCancellationRequested)
                {
                    _log.LogWarning(ex, "Expiry job run failed; will retry.");
                }
            }
        }
        catch (OperationCanceledException)
        {
        }
    }
}