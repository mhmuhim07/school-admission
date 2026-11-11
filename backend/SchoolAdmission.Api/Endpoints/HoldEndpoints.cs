using SchoolAdmission.Api.Api;
using SchoolAdmission.Api.Services;

namespace SchoolAdmission.Api.Endpoints;

public static class HoldEndpoints
{
    public static void MapHoldEndpoints(this WebApplication app)
    {
        // 4. POST /classes/{classId}/holds
        app.MapPost("/classes/{classId}/holds", async (string classId, HttpRequest req, IHoldService holds) =>
        {
            if (!StudentHeader.TryGet(req, out var studentId)) return StudentHeader.Invalid();
            return (await holds.CreateHoldAsync(classId, studentId)).ToHttpResult();
        });

        // 5. GET /holds/{holdId}
        app.MapGet("/holds/{holdId}", async (string holdId, IHoldService holds) =>
            (await holds.GetHoldAsync(holdId)).ToHttpResult());

        // 6. POST /holds/{holdId}/confirm
        app.MapPost("/holds/{holdId}/confirm", async (string holdId, HttpRequest req, IHoldService holds) =>
        {
            if (!StudentHeader.TryGet(req, out var studentId)) return StudentHeader.Invalid();
            return (await holds.ConfirmAsync(holdId, studentId)).ToHttpResult();
        });

        // 7. DELETE /holds/{holdId}
        app.MapDelete("/holds/{holdId}", async (string holdId, HttpRequest req, IHoldService holds) =>
        {
            if (!StudentHeader.TryGet(req, out var studentId)) return StudentHeader.Invalid();
            return (await holds.CancelAsync(holdId, studentId)).ToHttpResult();
        });

        // 8. GET /me/holds
        app.MapGet("/me/holds", async (HttpRequest req, IHoldService holds) =>
        {
            if (!StudentHeader.TryGet(req, out var studentId)) return StudentHeader.Invalid();
            return (await holds.ListForStudentAsync(studentId)).ToHttpResult();
        });
    }
}