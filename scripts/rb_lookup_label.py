#!/usr/bin/env python3
import os, sys
import xml.etree.ElementTree as ET

xml_path = os.environ.get("RB_XML", os.path.expanduser("~/rekordbox.xml"))

artist = (sys.argv[1] if len(sys.argv) > 1 else "").strip()
title  = (sys.argv[2] if len(sys.argv) > 2 else "").strip()

def norm(s: str) -> str:
    return " ".join((s or "").strip().lower().split())

if not os.path.exists(xml_path):
    print("")
    sys.exit(0)

try:
    tree = ET.parse(xml_path)
    root = tree.getroot()
except Exception:
    print("")
    sys.exit(0)

a = norm(artist)
t = norm(title)

for track in root.iter("TRACK"):
    tr_artist = norm(track.attrib.get("Artist", ""))
    tr_title  = norm(track.attrib.get("Name", ""))

    if tr_artist == a and tr_title == t:
        label = (track.attrib.get("Label", "") or "").strip()
        print(label)
        sys.exit(0)

print("")
