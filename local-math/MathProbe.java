package ir.fixquick.accounting;

import java.text.Normalizer;

/** Accept a bare answer or a complete, correct equality for the fixed probe only. */
final class MathProbe {
    private MathProbe() {}
    static boolean passed(String answer) {
        if (answer == null || answer.length() > 256) return false;
        String s=Normalizer.normalize(answer,Normalizer.Form.NFKC);
        StringBuilder b=new StringBuilder();
        for(int i=0;i<s.length();i++){
            char c=s.charAt(i);
            if(c>='\u06F0'&&c<='\u06F9')c=(char)('0'+c-'\u06F0');
            else if(c>='\u0660'&&c<='\u0669')c=(char)('0'+c-'\u0660');
            if(c=='\u200E'||c=='\u200F'||c=='\u061C'||(c>='\u202A'&&c<='\u202E')||(c>='\u2066'&&c<='\u2069'))continue;
            b.append(c);
        }
        s=b.toString().trim();
        if(s.endsWith("."))s=s.substring(0,s.length()-1).trim();
        // Do not merge separated digits, accept unrelated text or merely search for 42.
        return s.matches("42|(?:17\\s*\\+\\s*25|25\\s*\\+\\s*17)\\s*=\\s*42|42\\s*=\\s*(?:17\\s*\\+\\s*25|25\\s*\\+\\s*17)");
    }
}
