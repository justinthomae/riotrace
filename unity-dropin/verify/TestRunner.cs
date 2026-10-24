// Runs every [Test] method found in the compiled assembly.
using System;
using System.Linq;
using System.Reflection;
public static class TestRunner
{
    public static int Main()
    {
        int pass = 0, fail = 0;
        foreach (var t in Assembly.GetExecutingAssembly().GetTypes())
        foreach (var m in t.GetMethods().Where(x => x.GetCustomAttributes(typeof(NUnit.Framework.TestAttribute), false).Length > 0))
        {
            try { m.Invoke(Activator.CreateInstance(t), null); pass++; Console.WriteLine("PASS " + t.Name + "." + m.Name); }
            catch (TargetInvocationException e) { fail++; Console.WriteLine("FAIL " + t.Name + "." + m.Name + ": " + e.InnerException.Message); }
        }
        Console.WriteLine(pass + " passed, " + fail + " failed");
        return fail == 0 && pass > 0 ? 0 : 1;
    }
}
