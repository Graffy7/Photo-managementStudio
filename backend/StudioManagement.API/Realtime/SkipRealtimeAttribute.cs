namespace StudioManagement.API.Realtime;

// On an action that is called many times in a row (e.g. one call per uploaded photo): the realtime
// filter doesn't broadcast for it; a single closing call broadcasts instead.
[AttributeUsage(AttributeTargets.Method)]
public sealed class SkipRealtimeAttribute : Attribute;
