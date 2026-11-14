package ir.fixquick.accounting;

/** Conservative start gate for file-mapped CPU inference. Not a guarantee of successful allocation. */
final class AiMemoryPolicy {
    static final long MIB = 1024L * 1024L;
    static final long MIN_RAM = 5L * 1024L * MIB;
    static long requiredAvailable(long threshold) {
        return Math.max(1536L * MIB, Math.max(0L, threshold) + 256L * MIB);
    }
    static boolean canGenerate(long total, long available, long threshold, boolean lowMemory) {
        return total >= MIN_RAM && !lowMemory && available >= requiredAvailable(threshold);
    }
    static int contextLimit(long available, long threshold) {
        return available >= Math.max(2800000000L, requiredAvailable(threshold) + 512L * MIB) ? 4096 : 2048;
    }
}
