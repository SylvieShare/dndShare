"""Structural diagnostics shared by the wiki checker and its unit tests."""
import re

DATE = re.compile(r"(?:20\d{2}[-.]\d{2}[-.]\d{2}|\d{1,2}\.\d{1,2}\.20\d{2}|\d{1,2} (?:январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр)[а-я]* 20\d{2})", re.I)


def structural_warnings(relative, raw, lines):
    """Return (line, stable diagnostic code, explanation) tuples."""
    warnings = []
    if len(raw.splitlines()) > 600 or len(raw) > 60000:
        warnings.append((1, "oversized-page", "разделите страницу по ответственности или целым записям: более 600 строк или 60 000 символов"))

    related = [i for i, line in enumerate(lines) if re.match(r"^## +Связанные страницы\s*$", line)]
    for index in related:
        tail = "\n".join(lines[index + 1:]).strip()
        first, _, rest = tail.partition("\n\n")
        if rest.strip() or first.startswith("#"):
            warnings.append((index + 1, "content-after-related", "раздел «Связанные страницы» должен завершать документ; дополнение поместите в тематический раздел или отчёт"))

    intro = raw[:1000]
    is_report = relative.startswith("md/reports/") and relative != "md/reports/README.md"
    labeled_history = bool(re.search(r"Статус:.*(?:историч|журнал|указатель.*отч[её]т)", intro, re.I))
    if is_report:
        if not re.search(r"Статус:.*(?:отч[её]т|историч|журнал)", intro, re.I):
            warnings.append((1, "report-status", "укажите в начале, что это исторический отчёт, а не текущий контракт"))
        if not DATE.search(intro) and not re.search(r"(?:Commit|Дата|Срез)[^\n:]{0,40}:", intro, re.I):
            warnings.append((1, "report-snapshot", "укажите дату или commit исходного среза; не выдавайте дату переноса за дату измерения"))
    elif not labeled_history and not relative.startswith(("plans/", "reports/")):
        for number, line in enumerate(lines, 1):
            if re.match(r"^#{2,6} +", line) and DATE.search(line):
                warnings.append((number, "dated-current-section", "датированную историю вынесите в reports или явно обозначьте область журнала"))
    return warnings
