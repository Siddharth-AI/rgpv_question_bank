"""RGPV question paper scraper.

Downloads B.Tech PDFs from rgpvonline.com per SPEC.md §5.1.
URL pattern: https://www.rgpvonline.com/be/<slug>-<session>-<year>.pdf
"""

from __future__ import annotations

import argparse
import logging
import sys
import time
from collections import Counter
from pathlib import Path

import requests

BASE = "https://www.rgpvonline.com"
USER_AGENT = "PCST-Workshop-Bot/0.1 (educational; contact: workshop@pcst.local)"
SLEEP_SECONDS = 0.4
SESSIONS = ("jun", "dec")
DEFAULT_YEARS = range(2018, 2026)
DATA_ROOT = Path("data/raw")
REQUEST_TIMEOUT = 30

log = logging.getLogger("scraper")


# (slug, subject_name, semester, branch)
SUBJECTS: dict[str, tuple[str, str, int, str]] = {
    # ---- CSE ----
    "CS-302": ("cs-ct-co-it-ci-csit-302-discrete-structure", "Discrete Structure", 3, "CSE"),
    "CS-303": ("ad-ai-al-cd-cy-io-is-sd-cs-ra-303-data-structure-and-algorithms", "Data Structure and Algorithms", 3, "CSE"),
    "CS-304": ("cs-cy-csit-304-digital-system-digital-circuits-and-system", "Digital System", 3, "CSE"),
    "CS-305": ("cs-305-object-oriented-programming-and-methodology", "Object-Oriented Programming and Methodology", 3, "CSE"),
    "CS-402": ("cs-sd-402-analysis-design-of-algorithm", "Analysis and Design of Algorithm", 4, "CSE"),
    "CS-403": ("al-cd-cs-ct-co-sd-403-software-engineering", "Software Engineering", 4, "CSE"),
    "CS-404": ("al-csit-cs-ct-co-io-is-404-computer-organization-and-architecture", "Computer Organization and Architecture", 4, "CSE"),
    "CS-405": ("ad-cd-cs-sd-405-operating-systems", "Operating Systems", 4, "CSE"),
    "CS-501": ("cs-501-theory-of-computation", "Theory of Computation", 5, "CSE"),
    "CS-502": ("cs-502-database-management-systems", "Database Management Systems", 5, "CSE"),
    "CS-503-C": ("cs-503-c-cyber-security", "Cyber Security", 5, "CSE"),
    "CS-504": ("cs-504-internet-and-web-technology", "Internet and Web Technology", 5, "CSE"),
    "CS-601": ("cs-601-machine-learning", "Machine Learning", 6, "CSE"),
    "CS-602": ("cd-cs-602-computer-networks", "Computer Networks", 6, "CSE"),
    "CS-603-A": ("cs-603-a-advanced-computer-architecture", "Advanced Computer Architecture", 6, "CSE"),
    "CS-603-C": ("cs-sd-603-c-compiler-design", "Compiler Design", 6, "CSE"),
    "CS-604-B": ("cs-604-b-project-management", "Project Management", 6, "CSE"),
    "CS-701": ("cs-701-software-architectures", "Software Architectures", 7, "CSE"),
    "CS-702-D": ("cs-702-d-ai-702-d-big-data", "Big Data", 7, "CSE"),
    "CS-703-A": ("cs-703-a-cryptography-and-information-security", "Cryptography and Information Security", 7, "CSE"),
    "CS-703-B": ("cs-703-b-data-mining-and-warehousing", "Data Mining and Warehousing", 7, "CSE"),
    "CS-703-C": ("cs-703-c-al-703-c-agile-software-development", "Agile Software Development", 7, "CSE"),
    "CS-801": ("cs-801-internet-of-things", "Internet of Things", 8, "CSE"),
    "CS-802-B": ("cs-802-b-cloud-computing", "Cloud Computing", 8, "CSE"),
    "CS-803-A": ("cs-803-a-image-processing-and-computer-vision", "Image Processing and Computer Vision", 8, "CSE"),
    "CS-803-D": ("cs-803-d-managing-innovation-and-entrepreneurship", "Managing Innovation and Entrepreneurship", 8, "CSE"),

    # ---- IT ----
    "ALL-301": ("all-301-energy-and-environmental-engineering", "Energy and Environmental Engineering", 3, "IT"),
    "ALL-BT-301": ("all-bt-301-mathematics-3", "Mathematics 3", 3, "IT"),
    "IT-302": ("it-302-discrete-structure", "Discrete Structure", 3, "IT"),
    "IT-303": ("it-303-data-structure", "Data Structure", 3, "IT"),
    "IT-304": ("it-304-object-oriented-programming-and-methodology", "OOP and Methodology", 3, "IT"),
    "IT-305": ("it-305-digital-circuits-and-systems", "Digital Circuits and Systems", 3, "IT"),
    "BT-401": ("bt-401-mathematics-3", "Mathematics 3", 4, "IT"),
    "IT-402": ("ag-it-402-computer-arechitecture", "Computer Architecture", 4, "IT"),
    "IT-403": ("ag-csit-it-403-analysis-and-design-of-algorithm", "Analysis and Design of Algorithm", 4, "IT"),
    "IT-404": ("it-404-analog-and-digital-communication", "Analog and Digital Communication", 4, "IT"),
    "IT-405": ("ag-csit-it-405-data-base-management-system", "Database Management System", 4, "IT"),
    "IT-501": ("it-501-operating-system", "Operating System", 5, "IT"),
    "IT-502": ("it-502-computer-networks", "Computer Networks", 5, "IT"),
    "IT-503-C": ("it-503-c-object-oriented-analysis-and-design", "OOAD", 5, "IT"),
    "IT-504-C": ("it-504-c-java-programming", "Java Programming", 5, "IT"),
    "IT-601": ("it-601-computer-graphics-and-multimedia", "Computer Graphics and Multimedia", 6, "IT"),
    "IT-602": ("it-602-wireless-and-mobile-computing", "Wireless and Mobile Computing", 6, "IT"),
    "IT-603-A": ("it-603-a-compiler-design", "Compiler Design", 6, "IT"),
    "IT-603-B": ("it-603-b-data-mining", "Data Mining", 6, "IT"),
    "IT-604-B": ("it-604-b-software-engineering", "Software Engineering", 6, "IT"),
    "IT-701": ("it-701-soft-computing", "Soft Computing", 7, "IT"),
    "IT-702-B": ("it-702-b-cloud-computing", "Cloud Computing", 7, "IT"),
    "IT-703-B": ("it-703-b-internet-of-things", "Internet of Things", 7, "IT"),
    "IT-801": ("it-801-information-security", "Information Security", 8, "IT"),
    "IT-802-A": ("it-802-a-machine-learning", "Machine Learning", 8, "IT"),
    "IT-803-A": ("it-803-a-blockchain-technology", "Blockchain Technology", 8, "IT"),
    "IT-803-D": ("it-803-d-parallel-computing", "Parallel Computing", 8, "IT"),

    # ---- EC ----
    "EC-302": ("ec-302-electronic-measurements-and-instrumentation", "Electronic Measurements and Instrumentation", 3, "EC"),
    "EC-303": ("ec-303-digital-system-design", "Digital System Design", 3, "EC"),
    "EC-304": ("ea-ec-ed-io-304-electronic-devices", "Electronic Devices", 3, "EC"),
    "EC-305": ("ec-io-305-network-analysis", "Network Analysis", 3, "EC"),
    "EC-402": ("ec-402-signal-and-system", "Signal and System", 4, "EC"),
    "EC-403": ("ec-403-analog-communication", "Analog Communication", 4, "EC"),
    "EC-404": ("ec-404-control-system", "Control System", 4, "EC"),
    "EC-405": ("ec-405-analog-circuits", "Analog Circuits", 4, "EC"),
    "EC-501": ("ec-501-microprocessor-and-its-applications", "Microprocessor and Its Applications", 5, "EC"),
    "EC-502": ("ec-502-digital-communication", "Digital Communication", 5, "EC"),
    "EC-503-A": ("ec-503-a-communication-network-and-transmission-lines", "Communication Network and Transmission Lines", 5, "EC"),
    "EC-504-A": ("ec-504-a-electro-magnetic-theory", "Electromagnetic Theory", 5, "EC"),
    "EC-601": ("ec-601-digital-signal-processing", "Digital Signal Processing", 6, "EC"),
    "EC-602": ("ec-602-antenna-and-wave-propagation", "Antenna and Wave Propagation", 6, "EC"),
    "EC-603-A": ("ec-603-a-data-communication", "Data Communication", 6, "EC"),
    "EC-604-A": ("ec-604-a-microcontroller-and-embedded-system", "Microcontroller and Embedded System", 6, "EC"),
    "EC-604-C": ("ec-604-c-power-electronics", "Power Electronics", 6, "EC"),
    "EC-701": ("ec-701-vlsi-design", "VLSI Design", 7, "EC"),
    "EC-702-A": ("ec-702-a-microwave-engineering", "Microwave Engineering", 7, "EC"),
    "EC-703-A": ("ec-703-a-cellular-mobile-communication", "Cellular Mobile Communication", 7, "EC"),
    "EC-801": ("ec-801-optical-fiber-communication", "Optical Fiber Communication", 8, "EC"),
    "EC-802-B": ("ec-802-b-wireless-communications", "Wireless Communications", 8, "EC"),
    "EC-803-A": ("ec-803-a-wireless-networks", "Wireless Networks", 8, "EC"),

    # ---- ME ----
    "ME-302": ("au-me-302-thermodynamics", "Thermodynamics", 3, "ME"),
    "ME-303": ("au-me-303-materials-technology", "Materials Technology", 3, "ME"),
    "ME-304": ("au-me-304-strength-of-material", "Strength of Material", 3, "ME"),
    "ME-305": ("au-me-305-manufacturing-process", "Manufacturing Process", 3, "ME"),
    "ME-402": ("au-me-402-instrumentation-and-control", "Instrumentation and Control", 4, "ME"),
    "ME-403": ("au-me-403-theory-of-machines", "Theory of Machines", 4, "ME"),
    "ME-404": ("au-me-404-fluid-mechanics", "Fluid Mechanics", 4, "ME"),
    "ME-405": ("au-me-405-manufacturing-technology", "Manufacturing Technology", 4, "ME"),
    "ME-501": ("me-501-internal-combustion-engines", "Internal Combustion Engines", 5, "ME"),
    "ME-502": ("me-502-mechanical-vibration", "Mechanical Vibration", 5, "ME"),
    "ME-503-B": ("me-503-b-dynamics-of-machine", "Dynamics of Machine", 5, "ME"),
    "ME-504-A": ("me-504-a-industrial-engineering-and-ergonomics", "Industrial Engineering and Ergonomics", 5, "ME"),
    "ME-601": ("me-601-thermal-engineering-and-gas-dynamics", "Thermal Engineering and Gas Dynamics", 6, "ME"),
    "ME-602": ("me-602-machine-component-design", "Machine Component Design", 6, "ME"),
    "ME-603-A": ("me-603-a-turbomachinery", "Turbomachinery", 6, "ME"),
    "ME-603-C": ("me-603-c-product-design", "Product Design", 6, "ME"),
    "ME-604-C": ("au-me-604-c-renewable-energy-technology", "Renewable Energy Technology", 6, "ME"),
    "ME-701": ("me-701-heat-and-mass-transfer", "Heat and Mass Transfer", 7, "ME"),
    "ME-702-C": ("me-702-c-power-plant-engineering", "Power Plant Engineering", 7, "ME"),
    "ME-703-A": ("me-703-a-operation-research-and-supply-chain", "Operation Research and Supply Chain", 7, "ME"),
    "ME-801": ("me-801-refrigeration-and-air-conditioning", "Refrigeration and Air-Conditioning", 8, "ME"),
    "ME-802-A": ("me-802-a-automobile-engineering", "Automobile Engineering", 8, "ME"),
    "ME-803-B": ("me-803-b-energy-conservation-management-and-audit", "Energy Conservation Management and Audit", 8, "ME"),
}


def _pdf_url(slug: str, session: str, year: int) -> str:
    return f"{BASE}/be/{slug}-{session.lower()}-{year}.pdf"


def _target_path(subject_code: str, year: int, session: str) -> Path:
    return DATA_ROOT / subject_code / f"{year}-{session.upper()}.pdf"


def _session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"User-Agent": USER_AGENT, "Accept": "application/pdf,*/*"})
    return s


def download_subject(
    subject_code: str,
    years: range = DEFAULT_YEARS,
    session: requests.Session | None = None,
) -> Counter:
    """Download every (year, session) combo for one subject. Idempotent."""
    if subject_code not in SUBJECTS:
        raise KeyError(f"Unknown subject_code: {subject_code}")
    slug, name, sem, branch = SUBJECTS[subject_code]
    http = session or _session()
    stats: Counter = Counter()

    for year in years:
        for sess in SESSIONS:
            dest = _target_path(subject_code, year, sess)
            if dest.exists() and dest.stat().st_size > 0:
                log.info("SKIP %s %s %s (already on disk)", subject_code, year, sess.upper())
                stats["skip"] += 1
                continue
            url = _pdf_url(slug, sess, year)
            try:
                resp = http.get(url, timeout=REQUEST_TIMEOUT, allow_redirects=True)
            except requests.RequestException as exc:
                log.warning("FAIL %s %s %s — %s", subject_code, year, sess.upper(), exc)
                stats["fail"] += 1
                time.sleep(SLEEP_SECONDS)
                continue

            if resp.status_code == 200 and resp.content and resp.headers.get("Content-Type", "").lower().startswith(("application/pdf", "application/octet-stream")):
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(resp.content)
                log.info("OK   %s %s %s -> %s (%d bytes)", subject_code, year, sess.upper(), dest, len(resp.content))
                stats["ok"] += 1
            elif resp.status_code == 404:
                log.info("MISS %s %s %s (404)", subject_code, year, sess.upper())
                stats["miss"] += 1
            else:
                log.warning("FAIL %s %s %s — status=%s ct=%s", subject_code, year, sess.upper(), resp.status_code, resp.headers.get("Content-Type"))
                stats["fail"] += 1
            time.sleep(SLEEP_SECONDS)

    log.info("DONE %s — %s", subject_code, dict(stats))
    return stats


def download_all(years: range = DEFAULT_YEARS) -> Counter:
    http = _session()
    total: Counter = Counter()
    for code in SUBJECTS:
        total.update(download_subject(code, years=years, session=http))
    log.info("ALL DONE — %s", dict(total))
    return total


def _parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Download RGPV B.Tech PDFs.")
    group = p.add_mutually_exclusive_group(required=True)
    group.add_argument("--subject", help="Subject code (e.g. CS-502)")
    group.add_argument("--all", action="store_true", help="Download every subject in SUBJECTS")
    p.add_argument("--year-from", type=int, default=DEFAULT_YEARS.start)
    p.add_argument("--year-to", type=int, default=DEFAULT_YEARS.stop - 1)
    p.add_argument("-v", "--verbose", action="store_true")
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv if argv is not None else sys.argv[1:])
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)-5s %(name)s :: %(message)s",
    )
    years = range(args.year_from, args.year_to + 1)
    if args.all:
        download_all(years=years)
    else:
        download_subject(args.subject, years=years)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
