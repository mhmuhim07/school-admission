using Microsoft.EntityFrameworkCore;
using Npgsql;
using SchoolAdmission.Api;
using SchoolAdmission.Api.BackgroundJobs;
using SchoolAdmission.Api.Data;
using SchoolAdmission.Api.Endpoints;

var builder = WebApplication.CreateBuilder(args);

// R3: DB connection comes from the environment (ConnectionStrings__Default)
var connectionString = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("ConnectionStrings__Default is not set.");

// Cap the connection pool so heavy bursts queue up instead of exhausting Postgres.
var csb = new NpgsqlConnectionStringBuilder(connectionString);
if (!connectionString.Contains("Pool Size", StringComparison.OrdinalIgnoreCase))
{
    csb.MaxPoolSize = 40;
    csb.Timeout = 60;
}
builder.Services.AddDbContext<AdmissionDbContext>(o => o.UseNpgsql(csb.ConnectionString));

// R11: hold duration from HOLD_DURATION_SECONDS, default 600
var seconds = int.TryParse(builder.Configuration["HOLD_DURATION_SECONDS"], out var s) && s > 0 ? s : 600;
builder.Services.AddSingleton(new HoldSettings(TimeSpan.FromSeconds(seconds)));

builder.Services.AddHostedService<HoldExpiryWorker>();

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
public partial class Program { }