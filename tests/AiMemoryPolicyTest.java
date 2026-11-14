package ir.fixquick.accounting;

public final class AiMemoryPolicyTest {
    static void check(boolean value, String msg) { if (!value) throw new AssertionError(msg); }
    public static void main(String[] args) {
        long mib = AiMemoryPolicy.MIB, total=7770000000L, threshold=512*mib;
        check(AiMemoryPolicy.canGenerate(total, 1900*mib, threshold, false), "usable 8 GB device with managed free memory");
        check(!AiMemoryPolicy.canGenerate(total, 1400*mib, threshold, false), "insufficient working memory");
        check(!AiMemoryPolicy.canGenerate(total, 3000*mib, threshold, true), "honor OS low memory");
        check(!AiMemoryPolicy.canGenerate(4*1024*mib, 3000*mib, threshold, false), "physical RAM minimum");
        check(!AiMemoryPolicy.canGenerate(total, 1900*mib, 1800*mib, false), "honor high OS memory threshold");
        check(AiMemoryPolicy.contextLimit(1900*mib,threshold)==2048, "compact context");
        check(AiMemoryPolicy.contextLimit(3000*mib,threshold)==4096, "full context");
        check(AiMemoryPolicy.requiredAvailable(threshold)==1536*mib,"bounded headroom");
        System.out.println("PASS 8 memory policy checks (simulated Android memory values, not device inference)");
    }
}
