# Example Custom UI theme (Python): warm "sunset" colours, built in code.
# Import it in Equity Desk: tab 6 CUSTOM > UI > Import theme.
# The program runs once and must print the theme as ONE line of JSON.
import json

accent = "#ff7a45"

theme = {
    "name": "Sunset (example)",
    "colors": {                      # theme colour names, see README section 7
        "bg": "#140b0a",
        "panel2": "#21130f",
        "panel3": "#2c1912",
        "line": "#3d2419",
        "ink": "#fff1e8",
        "mut": "#b98d78",
        "amb": accent,
        "amb2": "#ffa070",
        "yel": "#ffd166",
        "up": "#7bd88f",
        "dn": "#ff4d6d",
    },
    "font": "Cascadia Mono, Consolas, monospace",
    "fontSize": 13,                  # 11 to 16
    "radius": 6,                     # 0 to 10
    # the nine tabs, in the order you want; tabs can be moved but never removed
    "tabs": ["DESK", "MON", "GP", "FIN", "NEWS", "CUSTOM", "NEW", "SET", "HELP"],
    # optional extra CSS (cosmetic properties only)
    "css": "#fkeys button.on { background: linear-gradient(90deg, %s, #ff4d6d); }" % accent,
}

print(json.dumps(theme))
