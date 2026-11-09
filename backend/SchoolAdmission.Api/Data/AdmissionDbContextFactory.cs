using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace SchoolAdmission.Api.Data;
public class AdmissionDbContextFactory : IDesignTimeDbContextFactory<AdmissionDbContext>
{
    public AdmissionDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<AdmissionDbContext>()
            .UseNpgsql("Host=db;Port=5432;Database=admission;Username=admission;Password=admission")
            .Options;
        return new AdmissionDbContext(options);
    }
}