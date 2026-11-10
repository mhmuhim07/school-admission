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