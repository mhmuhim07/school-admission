using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace SchoolAdmission.Api.Tests;

public class AdmissionApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public AdmissionApiTests(WebApplicationFactory<Program> factory) => _factory = factory;

    // ---------- helpers ----------

    // Unique 17-digit student IDs (4-digit prefix + 13 digits).
    private static List<string> NewStudentIds(int count)
    {
        var start = Random.Shared.NextInt64(1_000_000_000_000, 8_000_000_000_000);
        return Enumerable.Range(0, count).Select(i => "2015" + (start + i)).ToList();
    }

    private static async Task<string> CreateClass(HttpClient client, int seats)
    {
        var res = await client.PostAsJsonAsync("/classes",
            new { name = "Test " + Guid.NewGuid().ToString("N")[..6], totalSeats = seats });
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        var json = await res.Content.ReadFromJsonAsync<JsonElement>();
        return json.GetProperty("id").GetString()!;
    }

    private static Task<HttpResponseMessage> Send(HttpClient client, HttpMethod method, string url, string? studentId)
    {
        var request = new HttpRequestMessage(method, url);
        if (studentId is not null) request.Headers.Add("X-Student-Id", studentId);
        return client.SendAsync(request);
    }

    private static Task<HttpResponseMessage> Apply(HttpClient client, string classId, string studentId) =>
        Send(client, HttpMethod.Post, $"/classes/{classId}/holds", studentId);

    private static Task<HttpResponseMessage> Confirm(HttpClient client, string holdId, string studentId) =>
        Send(client, HttpMethod.Post, $"/holds/{holdId}/confirm", studentId);

    private static async Task<JsonElement> ReadJson(HttpResponseMessage res) =>
        await res.Content.ReadFromJsonAsync<JsonElement>();

    private static async Task<JsonElement> GetClass(HttpClient client, string classId) =>
        await ReadJson(await client.GetAsync($"/classes/{classId}"));

    // ---------- tests ----------

    [Fact]
    public async Task Concurrent_applications_never_exceed_total_seats()
    {
        var client = _factory.CreateClient();
        const int seats = 20;
        const int applicants = 200;
        var classId = await CreateClass(client, seats);

        var responses = await Task.WhenAll(
            NewStudentIds(applicants).Select(id => Apply(client, classId, id)));

        Assert.Equal(seats, responses.Count(r => r.StatusCode == HttpStatusCode.Created));
        Assert.Equal(applicants - seats, responses.Count(r => r.StatusCode == HttpStatusCode.Conflict));

        var cls = await GetClass(client, classId);
                var created = responses.Count(r => r.StatusCode == HttpStatusCode.Created);
        var conflicts = responses.Count(r => r.StatusCode == HttpStatusCode.Conflict);
        var summary = string.Join(", ", responses
            .GroupBy(r => (int)r.StatusCode)
            .Select(g => $"{g.Key} x{g.Count()}"));

        Assert.True(created == seats && conflicts == applicants - seats,
            $"Expected {seats} created and {applicants - seats} conflicts. Got: {summary}");
    }

    [Fact]
    public async Task Same_student_cannot_hold_two_seats_in_one_class()
    {
        var client = _factory.CreateClient();
        var classId = await CreateClass(client, 5);
        var student = NewStudentIds(1)[0];

        var responses = await Task.WhenAll(
            Enumerable.Range(0, 10).Select(_ => Apply(client, classId, student)));

        Assert.Equal(1, responses.Count(r => r.StatusCode == HttpStatusCode.Created));
        Assert.Equal(9, responses.Count(r => r.StatusCode == HttpStatusCode.Conflict));

        var cls = await GetClass(client, classId);
        Assert.Equal(1, cls.GetProperty("heldSeats").GetInt32());
    }

    [Fact]
    public async Task Confirming_twice_counts_only_one_confirmed_seat()
    {
        var client = _factory.CreateClient();
        var classId = await CreateClass(client, 3);
        var student = NewStudentIds(1)[0];

        var applied = await Apply(client, classId, student);
        Assert.Equal(HttpStatusCode.Created, applied.StatusCode);
        var holdId = (await ReadJson(applied)).GetProperty("holdId").GetString()!;

        var first = await Confirm(client, holdId, student);
        var second = await Confirm(client, holdId, student);

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        Assert.Equal("CONFIRMED", (await ReadJson(second)).GetProperty("status").GetString());

        var cls = await GetClass(client, classId);
        Assert.Equal(1, cls.GetProperty("confirmedSeats").GetInt32());
        Assert.Equal(0, cls.GetProperty("heldSeats").GetInt32());
        Assert.Equal(2, cls.GetProperty("availableSeats").GetInt32());
    }

    [Fact]
    public async Task Expired_hold_releases_seat_and_cannot_be_confirmed()
    {
        // This app instance uses a 1-second hold duration.
        var client = _factory
            .WithWebHostBuilder(b => b.UseSetting("HOLD_DURATION_SECONDS", "1"))
            .CreateClient();

        var classId = await CreateClass(client, 1);
        var ids = NewStudentIds(2);

        var applied = await Apply(client, classId, ids[0]);
        Assert.Equal(HttpStatusCode.Created, applied.StatusCode);
        var holdId = (await ReadJson(applied)).GetProperty("holdId").GetString()!;

        await Task.Delay(TimeSpan.FromSeconds(2.5));

        var hold = await ReadJson(await client.GetAsync($"/holds/{holdId}"));
        Assert.Equal("EXPIRED", hold.GetProperty("status").GetString());

        var cls = await GetClass(client, classId);
        Assert.Equal(0, cls.GetProperty("heldSeats").GetInt32());
        Assert.Equal(1, cls.GetProperty("availableSeats").GetInt32());

        var confirm = await Confirm(client, holdId, ids[0]);
        Assert.Equal(HttpStatusCode.Conflict, confirm.StatusCode);

        // The returned seat can be taken by someone else.
        var other = await Apply(client, classId, ids[1]);
        Assert.Equal(HttpStatusCode.Created, other.StatusCode);
    }

    [Fact]
    public async Task Another_student_cannot_confirm_someone_elses_hold()
    {
        var client = _factory.CreateClient();
        var classId = await CreateClass(client, 2);
        var ids = NewStudentIds(2);

        var applied = await Apply(client, classId, ids[0]);
        var holdId = (await ReadJson(applied)).GetProperty("holdId").GetString()!;

        var confirm = await Confirm(client, holdId, ids[1]);
        Assert.Equal(HttpStatusCode.Forbidden, confirm.StatusCode);
    }
}