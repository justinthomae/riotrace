// Compile-only stand-ins for the UnityEngine APIs the runtime uses. Never shipped.
using System;
using System.Collections;
namespace UnityEngine
{
    public class Object { public static void DontDestroyOnLoad(Object o) { } }
    public class Component : Object { }
    public class Behaviour : Component { }
    public class Coroutine { }
    public class MonoBehaviour : Behaviour { public Coroutine StartCoroutine(IEnumerator e) { return null; } }
    public sealed class GameObject : Object { public GameObject(string n) { } public T AddComponent<T>() where T : Component, new() { return new T(); } }
    public static class Application { public static void OpenURL(string url) { } }
    public static class Time { public static float unscaledTime; }
    public static class Screen { public static int width, height; }
    public static class Mathf
    {
        public static float Clamp(float v, float a, float b) { return Math.Max(a, Math.Min(b, v)); }
        public static float Min(float a, float b) { return Math.Min(a, b); }
        public static int RoundToInt(float f) { return (int)Math.Round(f); }
    }
    public static class Debug { public static void LogWarning(object m) { } }
    public static class JsonUtility { public static T FromJson<T>(string json) { return default(T); } }
    public struct Rect { public Rect(float x, float y, float w, float h) { } }
    public enum TextAnchor { MiddleCenter }
    public class GUIContent { public static GUIContent none = new GUIContent(); }
    public class GUIStyle { public GUIStyle(GUIStyle o) { } public int fontSize; public bool wordWrap; public TextAnchor alignment; }
    public class GUISkin { public GUIStyle label, button; }
    public static class GUI
    {
        public static int depth; public static GUISkin skin;
        public static void Box(Rect r, GUIContent c) { }
        public static void Label(Rect r, string t, GUIStyle s) { }
        public static bool Button(Rect r, string t, GUIStyle s) { return false; }
    }
}
namespace UnityEngine.Networking
{
    public class UploadHandler { }
    public class UploadHandlerRaw : UploadHandler { public UploadHandlerRaw(byte[] d) { } }
    public class DownloadHandler { public string text; }
    public class DownloadHandlerBuffer : DownloadHandler { }
    public class UnityWebRequestAsyncOperation { }
    public class UnityWebRequest : IDisposable
    {
        public enum Result { InProgress, Success, ConnectionError, ProtocolError, DataProcessingError }
        public UnityWebRequest(string url, string method) { }
        public UploadHandler uploadHandler; public DownloadHandler downloadHandler;
        public int timeout; public Result result; public long responseCode; public string error;
        public void SetRequestHeader(string k, string v) { }
        public UnityWebRequestAsyncOperation SendWebRequest() { return null; }
        public void Dispose() { }
    }
}
