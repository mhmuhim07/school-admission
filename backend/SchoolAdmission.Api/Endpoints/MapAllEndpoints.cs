
namespace SchoolAdmission.Api.Endpoints;

public static class MapAllEndpoints
{
    public static void MapEndpoints(this WebApplication app)
    {
        app.MapClassEndpoints();
        app.MapHoldEndpoints();
    }

}
