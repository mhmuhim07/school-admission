using System.Text.Json;
using SchoolAdmission.Api.Api;
using SchoolAdmission.Api.Services;

namespace SchoolAdmission.Api.Endpoints;

public static class ClassEndpoints
{
    public static void MapClassEndpoints(this WebApplication app)
    {
        var classes = app.MapGroup("/classes");

        // POST /classes
        classes.MapPost("/", async (HttpRequest request, IClassService service) =>
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
            return (await service.CreateAsync(body?.Name, body?.TotalSeats)).ToHttpResult();
        });

        // GET /classes
        classes.MapGet("/", async (IClassService service) => (await service.ListAsync()).ToHttpResult());

        // GET /classes/{classId}
        classes.MapGet("/{classId}", async (string classId, IClassService service) =>
            (await service.GetAsync(classId)).ToHttpResult());
    }
}