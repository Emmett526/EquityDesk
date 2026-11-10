/* Example Custom UI theme (C): black-and-white "mono" look.
 * Import it in Equity Desk: tab 6 CUSTOM > UI > Import theme (needs gcc, clang or tcc).
 * The program runs once and must print the theme as ONE line of JSON.
 */
#include <stdio.h>

int main(void)
{
    printf("{");
    printf("\"name\": \"Mono (example)\", ");
    printf("\"colors\": {\"bg\": \"#000000\", \"panel2\": \"#0c0c0c\", \"panel3\": \"#161616\", "
           "\"line\": \"#2a2a2a\", \"ink\": \"#f2f2f2\", \"mut\": \"#8a8a8a\", "
           "\"amb\": \"#ffffff\", \"amb2\": \"#dddddd\", \"yel\": \"#cfcfcf\", "
           "\"up\": \"#9be29b\", \"dn\": \"#ff8a8a\"}, ");
    printf("\"radius\": 0, ");
    printf("\"css\": \"#fkeys button.on { background: #ffffff; color: #000000; }\"");
    printf("}\n");
    return 0;
}
