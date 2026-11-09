namespace SchoolAdmission.Api.Data;

public enum HoldStatus {HELD, CONFIRMED, EXPIRED, CANCELLED}

public class SchoolClass
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public int TotalSeats { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class Hold
{
    public string Id { get; set; } = "";
    public string ClassId { get; set; } = "";
    public string StudentId { get; set; } = "";
    public HoldStatus Status { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? ConfirmedAt { get; set; }
    public SchoolClass? Class { get; set; }
}