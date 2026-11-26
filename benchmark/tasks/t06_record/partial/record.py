import csv
import io


def parse_record(text, delimiter=","):
    if len(delimiter) != 1:
        raise ValueError("delimiter")
    rows = list(csv.reader(io.StringIO(text, newline=""), delimiter=delimiter))
    return rows[0] if rows else [""]


def format_record(fields, delimiter=","):
    if len(delimiter) != 1:
        raise ValueError("delimiter")
    out = io.StringIO()
    csv.writer(out, delimiter=delimiter, lineterminator="").writerow(fields)
    return out.getvalue()
