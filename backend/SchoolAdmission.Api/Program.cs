using Microsoft.EntityFrameworkCore;
using SchoolAdmission.Api;
using SchoolAdmission.Api.Data;
using SchoolAdmission.Api.Endpoints;

var builder = WebApplication.CreateBuilder(args);

// R3: DB connection comes from the environment (ConnectionStrings__Default)
var connectionString = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("ConnectionStrings__Default is not set.");
builder.Services.AddDbContext<AdmissionDbContext>(o => o.UseNpgsql(connectionString));

// R11: hold duration from HOLD_DURATION_SECONDS, default 600
var seconds = int.TryParse(builder.Configuration["HOLD_DURATION_SECONDS"], out var s) && s > 0 ? s : 600;
builder.Services.AddSingleton(new HoldSettings(TimeSpan.FromSeconds(seconds)));

var app = builder.Build();

// R5/R15: create or update the schema automatically on startup
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AdmissionDbContext>();
    await db.Database.MigrateAsync();
}

app.MapGet("/", () => "Hello World!");
app.MapEndpoints();
app.Run();