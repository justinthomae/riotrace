// Minimal NUnit subset so the editor tests compile and run outside Unity.
using System;
using System.Collections;
namespace NUnit.Framework
{
    [AttributeUsage(AttributeTargets.Method)] public class TestAttribute : Attribute { }
    public class AssertionException : Exception { public AssertionException(string m) : base(m) { } }
    public static class Assert
    {
        public static void IsTrue(bool c) { if (!c) throw new AssertionException("Expected true"); }
        public static void IsFalse(bool c) { if (c) throw new AssertionException("Expected false"); }
        public static void IsNull(object o) { if (o != null) throw new AssertionException("Expected null, got " + o); }
        public static void IsNotNull(object o) { if (o == null) throw new AssertionException("Expected not null"); }
        public static void AreEqual(object e, object a) { if (!Equals(e, a)) throw new AssertionException("Expected <" + e + "> got <" + a + ">"); }
    }
    public static class CollectionAssert
    {
        public static void AreEqual(IEnumerable e, IEnumerable a)
        {
            var ea = e.GetEnumerator(); var aa = a.GetEnumerator();
            while (true)
            {
                bool m1 = ea.MoveNext(), m2 = aa.MoveNext();
                if (m1 != m2) throw new AssertionException("Collections differ in length");
                if (!m1) return;
                if (!Equals(ea.Current, aa.Current)) throw new AssertionException("Expected <" + ea.Current + "> got <" + aa.Current + ">");
            }
        }
    }
}
