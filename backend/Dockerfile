FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY SchoolAdmission.Api/*.csproj SchoolAdmission.Api/
RUN dotnet restore SchoolAdmission.Api/SchoolAdmission.Api.csproj
COPY . .
RUN dotnet publish SchoolAdmission.Api/SchoolAdmission.Api.csproj -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .
ENV ASPNETCORE_URLS=http://+:8880
EXPOSE 8880
ENTRYPOINT ["dotnet", "SchoolAdmission.Api.dll"]