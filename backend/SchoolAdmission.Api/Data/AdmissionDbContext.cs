using Microsoft.EntityFrameworkCore;
using Microsoft.Net.Http.Headers;

namespace SchoolAdmission.Api.Data;

public class AdmissionDbContext(DbContextOptions<AdmissionDbContext> options) : DbContext(options)
{
    public DbSet<SchoolClass> Classes => Set<SchoolClass>();
    public DbSet<Hold> Holds => Set<Hold>();

    protected override void OnModelCreating(ModelBuilder mb)
    {
        mb.Entity<SchoolClass>(e =>
        {
            e.ToTable("classes");
            e.HasKey(c => c.Id);
            e.Property(c => c.Id).HasMaxLength(40);
            e.Property(c => c.Name).HasMaxLength(200).IsRequired();
        });
        mb.Entity<Hold>(e =>
        {
            e.ToTable("holds");
            e.HasKey(h => h.Id);
            e.Property(h => h.Id).HasMaxLength(40);
            e.Property(h => h.ClassId).HasMaxLength(40).IsRequired();
            e.Property(h => h.StudentId).HasMaxLength(17).IsRequired();
            e.Property(h => h.Status).HasConversion<string>().HasMaxLength(16);

            e.HasOne(h => h.Class)
             .WithMany()
             .HasForeignKey(h => h.ClassId)
             .OnDelete(DeleteBehavior.Restrict);

            //at most one active (HELD or CONFIRMED) application per student per class
            e.HasIndex(h => new { h.ClassId, h.StudentId })
             .IsUnique()
             .HasDatabaseName("ux_holds_active_student_class")
             .HasFilter("\"Status\" IN ('HELD','CONFIRMED')");
            
            // fast seat counting and /me/holds
            e.HasIndex(h => new { h.ClassId, h.Status, h.ExpiresAt });
            e.HasIndex(h => h.StudentId);
        });
    }

}
