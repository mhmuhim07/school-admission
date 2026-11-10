namespace SchoolAdmission.Api.Api;

public record CreateClassRequest(string? Name, int? TotalSeats);

public record ClassResponse(
    string Id, string Name, int TotalSeats,
    int HeldSeats, int ConfirmedSeats, int AvailableSeats);

public static class ApiErrors
{
    public static IResult Error(int status, string code, string message) =>
        Results.Json(new { error = new { code, message } }, statusCode: status);
}

public static class StudentHeader
{
    public const string Name = "X-Student-Id";

    // Returns true only for exactly 17 digits.
    public static bool TryGet(HttpRequest request, out string studentId)
    {
        Console.WriteLine($"[debug] X-Student-Id='{request.Headers["X-Student-Id"]}' length={request.Headers["X-Student-Id"].ToString().Length}");
        studentId = request.Headers[Name].ToString().Trim();
        return studentId.Length == 17 && studentId.All(char.IsAsciiDigit);
    }

    public static IResult Invalid() => ApiErrors.Error(400, "invalid_student_id",
        "Please enter a valid 17-digit birth registration number.");
}