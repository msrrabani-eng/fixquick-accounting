package ir.fixquick.accounting;
public class MathProbeTest {
    public static void main(String[] args) {
        String[] yes={"42","۴۲","٤٢","17 + 25 = 42","42 = 25 + 17","۱۷+۲۵=۴۲","۲۵ + ۱۷ = ٤٢.","\u200F۴۲ = ۲۵ + ۱۷", "42."};
        String[] no={null,"","4 2","142","42.5","17+25=43","17+25=42 or 43","42 is incorrect","42=20+21","17+25=42 [output limit]","42\n43","17+25=4 2","not 42"};
        for(String s:yes)if(!MathProbe.passed(s))throw new AssertionError("Rejected correct probe: "+s);
        for(String s:no)if(MathProbe.passed(s))throw new AssertionError("Accepted incorrect probe: "+s);
        System.out.println("v039 Java probe: accepted correct numeric/equation answers and rejected false positives");
    }
}
