using SchoolAdmission.Api.Api;

namespace SchoolAdmission.Api.Services;

public record ServiceError(int Status, string Code, string Message);

public class ServiceResult
{
    public int Status { get; private init; } = 200;
    public object? Value { get; private init; }
    public ServiceError? Error { get; private init; }

    public static ServiceResult Ok(object value, int status = 200) => new() { Value = value, Status = status };
    public static ServiceResult NoContent() => new() { Status = 204 };
    public static ServiceResult Fail(int status, string code, string message) =>
        new() { Status = status, Error = new ServiceError(status, code, message) };

    public IResult ToHttpResult() =>
        Error is not null ? ApiErrors.Error(Error.Status, Error.Code, Error.Message)
        : Status == 204 ? Results.NoContent()
        : Results.Json(Value, statusCode: Status);
}