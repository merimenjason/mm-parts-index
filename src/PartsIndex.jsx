import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import * as XLSX from "xlsx";

/* ============================================================
   PartsIndex — SG Motor TP Parts Pricing Reference
   Merimen / Fermion brand palette (petrol-teal + lime accent).
   Benchmark uses CONFIGURABLE FUZZY NAME MATCHING (not exact PN).
   All 8 analysis methods are computed and viewable under Analytics.
   Persists via window.storage. Demo = initial 18 supplier bills.
   ============================================================ */

/* ---------- Merimen "Fermion" brand palette ---------- */
const TEAL = "#006E96", TEAL_D = "#00567A", TEAL_L = "#00A0B9";
const LIME = "#C3D700", GREEN = "#2C7837", ICE = "#E1FAFF";
const INK = "#0A2733", PANEL = "#0F3543", LINE = "#1E4E60";
const TEXT = "#EAF6FA", MUTE = "#8FB6C4", RED = "#E8615A", AMBER = "#E8A33D";

const SG_MAKES = ["Toyota","Honda","Mazda","Nissan","Hyundai","Kia","Mercedes-Benz","BMW","Audi",
  "Volkswagen","Mitsubishi","Suzuki","Subaru","Lexus","Mitsubishi Fuso","Porsche","Chevrolet"];

const DEMO_18 = [{"supplier": "Pas Auto Pte Ltd", "bill_no": "I15294825", "bill_date": "09/06/2018", "make": "Mercedes-Benz", "model": "Citan (W415)", "doc_type": "Tax Invoice", "part_name": "FRT APRON", "part_number": "415 882 0203MB", "qty": 1, "unit_cost": 218.0, "total_cost": 218.0}, {"supplier": "Pas Auto Pte Ltd", "bill_no": "I15294825", "bill_date": "09/06/2018", "make": "Mercedes-Benz", "model": "Citan (W415)", "doc_type": "Tax Invoice", "part_name": "FRT GRILLE SUPPORT", "part_number": "415 880 0508MB", "qty": 1, "unit_cost": 98.0, "total_cost": 98.0}, {"supplier": "Pas Auto Pte Ltd", "bill_no": "I15294825", "bill_date": "09/06/2018", "make": "Mercedes-Benz", "model": "Citan (W415)", "doc_type": "Tax Invoice", "part_name": "SUPPORT BRACKET", "part_number": "415 880 0510MB", "qty": 1, "unit_cost": 75.0, "total_cost": 75.0}, {"supplier": "Pas Auto Pte Ltd", "bill_no": "I15294825", "bill_date": "09/06/2018", "make": "Mercedes-Benz", "model": "Citan (W415)", "doc_type": "Tax Invoice", "part_name": "BUMPER REINFORCMENT FRT", "part_number": "415 885 0205MB", "qty": 1, "unit_cost": 452.0, "total_cost": 452.0}, {"supplier": "Pas Auto Pte Ltd", "bill_no": "I15294825", "bill_date": "09/06/2018", "make": "Mercedes-Benz", "model": "Citan (W415)", "doc_type": "Tax Invoice", "part_name": "BUMPER INNER FRAME FRT", "part_number": "415 885 0211MB", "qty": 1, "unit_cost": 115.0, "total_cost": 115.0}, {"supplier": "Pas Auto Pte Ltd", "bill_no": "I15294825", "bill_date": "09/06/2018", "make": "Mercedes-Benz", "model": "Citan (W415)", "doc_type": "Tax Invoice", "part_name": "FOG LAMP COVER", "part_number": "415 885 0008MB", "qty": 2, "unit_cost": 98.0, "total_cost": 196.0}, {"supplier": "Pas Auto Pte Ltd", "bill_no": "I15294825", "bill_date": "09/06/2018", "make": "Mercedes-Benz", "model": "Citan (W415)", "doc_type": "Tax Invoice", "part_name": "ENGINE UNDER COVER", "part_number": "415 888 0004MB", "qty": 1, "unit_cost": 115.0, "total_cost": 115.0}, {"supplier": "Pas Auto Pte Ltd", "bill_no": "I15294825", "bill_date": "09/06/2018", "make": "Mercedes-Benz", "model": "Citan (W415)", "doc_type": "Tax Invoice", "part_name": "CLIPS GRILLE", "part_number": "000 882 0506MB", "qty": 10, "unit_cost": 5.8, "total_cost": 58.0}, {"supplier": "Pas Auto Pte Ltd", "bill_no": "I15294818", "bill_date": "08/06/2018", "make": "Mercedes-Benz", "model": "Citan (W415)", "doc_type": "Tax Invoice", "part_name": "HEADLAMP HOUSE", "part_number": "415 826 0001MB", "qty": 2, "unit_cost": 288.0, "total_cost": 576.0}, {"supplier": "Pas Auto Pte Ltd", "bill_no": "I15294818", "bill_date": "08/06/2018", "make": "Mercedes-Benz", "model": "Citan (W415)", "doc_type": "Tax Invoice", "part_name": "FRT BUMPER GRILLE", "part_number": "415 885 0153MB", "qty": 1, "unit_cost": 62.0, "total_cost": 62.0}, {"supplier": "Pas Auto Pte Ltd", "bill_no": "I15294818", "bill_date": "08/06/2018", "make": "Mercedes-Benz", "model": "Citan (W415)", "doc_type": "Tax Invoice", "part_name": "BUMPER SET", "part_number": "415 885 0201MB", "qty": 1, "unit_cost": 980.0, "total_cost": 980.0}, {"supplier": "Pas Auto Pte Ltd", "bill_no": "I15294818", "bill_date": "08/06/2018", "make": "Mercedes-Benz", "model": "Citan (W415)", "doc_type": "Tax Invoice", "part_name": "GRILLE", "part_number": "415 888 0023MB", "qty": 1, "unit_cost": 145.0, "total_cost": 145.0}, {"supplier": "Pas Auto Pte Ltd", "bill_no": "I15294818", "bill_date": "08/06/2018", "make": "Mercedes-Benz", "model": "Citan (W415)", "doc_type": "Tax Invoice", "part_name": "GRILLE MOULDING", "part_number": "415 880 0023MB", "qty": 1, "unit_cost": 240.0, "total_cost": 240.0}, {"supplier": "Pas Auto Pte Ltd", "bill_no": "I15294818", "bill_date": "08/06/2018", "make": "Mercedes-Benz", "model": "Citan (W415)", "doc_type": "Tax Invoice", "part_name": "RADIATOR", "part_number": "415 888 0511MB", "qty": 1, "unit_cost": 550.0, "total_cost": 550.0}, {"supplier": "Pas Auto Pte Ltd", "bill_no": "I15294835", "bill_date": "11/06/2018", "make": "Mercedes-Benz", "model": "Citan (W415)", "doc_type": "Tax Invoice", "part_name": "RADIATOR GUIDE", "part_number": "415 888 0020MB", "qty": 1, "unit_cost": 275.0, "total_cost": 275.0}, {"supplier": "Pas Auto Pte Ltd", "bill_no": "I15294835", "bill_date": "11/06/2018", "make": "Mercedes-Benz", "model": "Citan (W415)", "doc_type": "Tax Invoice", "part_name": "TOW COVER", "part_number": "415 885 0233MB", "qty": 1, "unit_cost": 18.0, "total_cost": 18.0}, {"supplier": "Pas Auto Pte Ltd", "bill_no": "I15294835", "bill_date": "11/06/2018", "make": "Mercedes-Benz", "model": "Citan (W415)", "doc_type": "Tax Invoice", "part_name": "CENTRE LOGO", "part_number": "415 882 0221MB", "qty": 1, "unit_cost": 58.0, "total_cost": 58.0}, {"supplier": "Pas Auto Pte Ltd", "bill_no": "I15294835", "bill_date": "11/06/2018", "make": "Mercedes-Benz", "model": "Citan (W415)", "doc_type": "Tax Invoice", "part_name": "NUTS", "part_number": "415 882 0222MB", "qty": 2, "unit_cost": 7.0, "total_cost": 14.0}, {"supplier": "Pas Auto Pte Ltd", "bill_no": "I15294835", "bill_date": "11/06/2018", "make": "Mercedes-Benz", "model": "Citan (W415)", "doc_type": "Tax Invoice", "part_name": "BUMPER BRACKET", "part_number": "415 885 0215MB", "qty": 2, "unit_cost": 36.0, "total_cost": 72.0}, {"supplier": "Pas Auto Pte Ltd", "bill_no": "I15294835", "bill_date": "11/06/2018", "make": "Mercedes-Benz", "model": "Citan (W415)", "doc_type": "Tax Invoice", "part_name": "RADIATOR CLIP", "part_number": "000 888 0001MB", "qty": 2, "unit_cost": 12.0, "total_cost": 24.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8049120", "bill_date": "28/12/2016", "make": "Hyundai", "model": "Tucson (TL/2L)", "doc_type": "Tax Invoice", "part_name": "MIRROR ASSY,DR LH", "part_number": "HY87610-2L500", "qty": 1, "unit_cost": 230.0, "total_cost": 230.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8049120", "bill_date": "28/12/2016", "make": "Hyundai", "model": "Tucson (TL/2L)", "doc_type": "Tax Invoice", "part_name": "PANEL-FENDER LH", "part_number": "HY66311-2L010", "qty": 1, "unit_cost": 160.0, "total_cost": 160.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8049120", "bill_date": "28/12/2016", "make": "Hyundai", "model": "Tucson (TL/2L)", "doc_type": "Tax Invoice", "part_name": "CLIP-BUMPER", "part_number": "HY86590-28000 H", "qty": 10, "unit_cost": 1.5, "total_cost": 15.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8049120", "bill_date": "28/12/2016", "make": "Hyundai", "model": "Tucson (TL/2L)", "doc_type": "Tax Invoice", "part_name": "COVER-FR BUMPER", "part_number": "HY86511-2L000", "qty": 1, "unit_cost": 170.0, "total_cost": 170.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8049120", "bill_date": "28/12/2016", "make": "Hyundai", "model": "Tucson (TL/2L)", "doc_type": "Tax Invoice", "part_name": "ARM,FR LWR LH", "part_number": "HY54500-2H000 H", "qty": 1, "unit_cost": 90.0, "total_cost": 90.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8049120", "bill_date": "28/12/2016", "make": "Hyundai", "model": "Tucson (TL/2L)", "doc_type": "Tax Invoice", "part_name": "BALL JOINT ASSY", "part_number": "HY51760-2H000 HA", "qty": 1, "unit_cost": 23.0, "total_cost": 23.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8049120", "bill_date": "28/12/2016", "make": "Hyundai", "model": "Tucson (TL/2L)", "doc_type": "Tax Invoice", "part_name": "END ASSY-TIE ROD LH", "part_number": "HY56820-2H000 HA", "qty": 1, "unit_cost": 26.0, "total_cost": 26.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8049120", "bill_date": "28/12/2016", "make": "Hyundai", "model": "Tucson (TL/2L)", "doc_type": "Tax Invoice", "part_name": "BALL JOINT ASSY-INR L/R", "part_number": "KA56540 2H 000", "qty": 1, "unit_cost": 42.0, "total_cost": 42.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8049120", "bill_date": "28/12/2016", "make": "Hyundai", "model": "Tucson (TL/2L)", "doc_type": "Tax Invoice", "part_name": "GUARD ASSY-FR WHEEL MUD LH", "part_number": "HY86831-2L000", "qty": 1, "unit_cost": 19.0, "total_cost": 19.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8049489", "bill_date": "30/12/2016", "make": "Hyundai", "model": "Tucson (TL/2L)", "doc_type": "Tax Invoice", "part_name": "HEADLAMP ASSY-LH", "part_number": "HY92101-2L132", "qty": 1, "unit_cost": 210.0, "total_cost": 210.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8122883", "bill_date": "04/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "SEAL FRONT", "part_number": "MBA213 720 60 02", "qty": 1, "unit_cost": 22.0, "total_cost": 22.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8122883", "bill_date": "04/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "COVER STRIP", "part_number": "MBA213 730 02 02", "qty": 1, "unit_cost": 22.0, "total_cost": 22.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8122883", "bill_date": "04/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "SPRING ELEMENT", "part_number": "MBA205 880 00 27", "qty": 2, "unit_cost": 18.0, "total_cost": 36.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8122883", "bill_date": "04/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "PLUG", "part_number": "MBA002 997 33 86", "qty": 5, "unit_cost": 5.0, "total_cost": 25.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8122844", "bill_date": "04/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "TRIM BUMPER", "part_number": "MBA213 885 03 38 9999", "qty": 1, "unit_cost": 660.0, "total_cost": 660.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8122844", "bill_date": "04/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "BLIND RIVET", "part_number": "MBA003 990 94 97 64", "qty": 10, "unit_cost": 4.0, "total_cost": 40.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8122844", "bill_date": "04/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "COVER BUMPER", "part_number": "MBA213 885 16 00", "qty": 1, "unit_cost": 32.0, "total_cost": 32.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8122844", "bill_date": "04/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "COVER TOWING", "part_number": "MBA213 885 03 22 9999", "qty": 1, "unit_cost": 32.0, "total_cost": 32.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8122844", "bill_date": "04/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "DISTANCE SENSOR", "part_number": "MBA000 905 55 04 9999", "qty": 1, "unit_cost": 95.0, "total_cost": 95.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8122844", "bill_date": "04/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "DISTANCE SENSOR", "part_number": "MBA000 905 56 04 9999", "qty": 1, "unit_cost": 95.0, "total_cost": 95.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8122844", "bill_date": "04/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "DECOUPLING RING", "part_number": "MBA000 542 12 51", "qty": 2, "unit_cost": 6.0, "total_cost": 12.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8122844", "bill_date": "04/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "IMPACT ABSORBER", "part_number": "MBA213 885 04 37", "qty": 1, "unit_cost": 80.0, "total_cost": 80.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8122844", "bill_date": "04/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "CROSS MEMBER", "part_number": "MBA213 620 01 30", "qty": 1, "unit_cost": 273.0, "total_cost": 273.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8122844", "bill_date": "04/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "HEADLAMP UNIT", "part_number": "MBA213 906 67 01", "qty": 1, "unit_cost": 2050.0, "total_cost": 2050.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8122844", "bill_date": "04/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "HOOD", "part_number": "MBA213 880 03 57", "qty": 1, "unit_cost": 1205.0, "total_cost": 1205.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8122844", "bill_date": "04/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "LOGO BONNET", "part_number": "MBA212 817 03 16", "qty": 1, "unit_cost": 43.0, "total_cost": 43.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8122844", "bill_date": "04/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "TREENAIL", "part_number": "MBA001 988 03 25", "qty": 12, "unit_cost": 4.0, "total_cost": 48.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8122844", "bill_date": "04/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "FRONT FENDER", "part_number": "MBA213 880 00 18", "qty": 1, "unit_cost": 530.0, "total_cost": 530.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8122844", "bill_date": "04/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "FRONT FENDER", "part_number": "MBA213 880 01 18", "qty": 1, "unit_cost": 530.0, "total_cost": 530.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8122844", "bill_date": "04/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "WHEEL HOUSE COVERING", "part_number": "MBA238 690 16 03", "qty": 1, "unit_cost": 67.0, "total_cost": 67.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8122844", "bill_date": "04/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "COVER, WHEEL ARCH", "part_number": "MBA238 691 10 00", "qty": 1, "unit_cost": 105.0, "total_cost": 105.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8122844", "bill_date": "04/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "RIVET", "part_number": "MBA124 990 04 92", "qty": 10, "unit_cost": 4.0, "total_cost": 40.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8122844", "bill_date": "04/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "MIRROR GLASS", "part_number": "MBA099 810 02 16", "qty": 1, "unit_cost": 520.0, "total_cost": 520.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8122844", "bill_date": "04/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "SIGNAL LEN RH", "part_number": "MBA099 906 46 01", "qty": 1, "unit_cost": 97.0, "total_cost": 97.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8122844", "bill_date": "04/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "MIRROR BOWL", "part_number": "MBA099 811 04 00 9197", "qty": 1, "unit_cost": 108.0, "total_cost": 108.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8122844", "bill_date": "04/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "DRIVER'S DOOR", "part_number": "MBA213 720 02 05", "qty": 1, "unit_cost": 1050.0, "total_cost": 1050.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8122844", "bill_date": "04/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "W204 FR & RR DOOR RH & LH WEATHE", "part_number": "MBA204 727 11 87", "qty": 2, "unit_cost": 153.0, "total_cost": 306.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8122844", "bill_date": "04/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "SEALING RAIL", "part_number": "MBA213 720 02 24 28", "qty": 1, "unit_cost": 53.0, "total_cost": 53.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8122844", "bill_date": "04/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "DOOR HANDLE", "part_number": "MBA099 760 74 00 9999", "qty": 1, "unit_cost": 328.0, "total_cost": 328.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8122844", "bill_date": "04/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "TRIM RING", "part_number": "MBA099 766 18 00 9999", "qty": 1, "unit_cost": 36.0, "total_cost": 36.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8122844", "bill_date": "04/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "REAR DOOR", "part_number": "MBA213 730 02 05", "qty": 1, "unit_cost": 1160.0, "total_cost": 1160.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8122844", "bill_date": "04/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "CONTROL UNIT", "part_number": "MBA222 900 30 13", "qty": 1, "unit_cost": 440.0, "total_cost": 440.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8122861", "bill_date": "04/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "COOLANT PUMP", "part_number": "MBA000 500 43 86", "qty": 1, "unit_cost": 420.0, "total_cost": 420.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8122909", "bill_date": "04/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "HEADLAMP UNIT", "part_number": "MBA213 906 68 01", "qty": 1, "unit_cost": 2050.0, "total_cost": 2050.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8123023", "bill_date": "05/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "WINDOW GUIDE", "part_number": "MBA213 725 28 00", "qty": 1, "unit_cost": 83.0, "total_cost": 83.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8123192", "bill_date": "08/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "CONSOLE", "part_number": "MBA213 620 17 01", "qty": 1, "unit_cost": 115.0, "total_cost": 115.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8123192", "bill_date": "08/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "BASIC MOUNTING", "part_number": "MBA213 885 11 65", "qty": 1, "unit_cost": 28.0, "total_cost": 28.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8123192", "bill_date": "08/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "RESERVOIR,RADIATOR RESERVOIR", "part_number": "MBA205 500 00 49", "qty": 1, "unit_cost": 63.0, "total_cost": 63.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8123192", "bill_date": "08/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "MOUNTING RAIL", "part_number": "MBA213 885 06 21", "qty": 1, "unit_cost": 10.0, "total_cost": 10.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8123096", "bill_date": "06/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "MIRROR FRAME", "part_number": "MBA213 810 74 01", "qty": 1, "unit_cost": 650.0, "total_cost": 650.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8123197", "bill_date": "08/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "ANTENNA", "part_number": "MBA213 905 50 09", "qty": 1, "unit_cost": 72.0, "total_cost": 72.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8123493", "bill_date": "10/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "ELECTRICAL WIRING HARNESS", "part_number": "MBA213 540 59 03", "qty": 1, "unit_cost": 255.0, "total_cost": 255.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8123493", "bill_date": "10/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "HEXA BOLT", "part_number": "MBN000 000 00 2819", "qty": 3, "unit_cost": 4.0, "total_cost": 12.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8123493", "bill_date": "10/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "PAN HEAD SCREW", "part_number": "MBN000 000 00 2359", "qty": 1, "unit_cost": 4.0, "total_cost": 4.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8123493", "bill_date": "10/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "ADJ. DRV. MIRROR HOUSING", "part_number": "MBA099 820 20 00", "qty": 1, "unit_cost": 130.0, "total_cost": 130.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8123493", "bill_date": "10/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "AMBIENT LAMP", "part_number": "MBA099 906 10 01", "qty": 1, "unit_cost": 32.0, "total_cost": 32.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8123493", "bill_date": "10/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "PLUG", "part_number": "MBA053 545 38 28", "qty": 1, "unit_cost": 6.0, "total_cost": 6.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8123495", "bill_date": "10/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "TRIM, WINDOW FRAME", "part_number": "MBA213 727 02 00 9051", "qty": 1, "unit_cost": 53.0, "total_cost": 53.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8123495", "bill_date": "10/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "DOOR HANDLE", "part_number": "MBA099 760 20 01 9197", "qty": 1, "unit_cost": 355.0, "total_cost": 355.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8123642", "bill_date": "11/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "COVER F ENGINE", "part_number": "MBA213 520 06 00", "qty": 1, "unit_cost": 35.0, "total_cost": 35.0}, {"supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8123711", "bill_date": "12/10/2018", "make": "Mercedes-Benz", "model": "E-Class (W213)", "doc_type": "Tax Invoice", "part_name": "TIE ROD", "part_number": "MBA205 460 08 05", "qty": 1, "unit_cost": 110.0, "total_cost": 110.0}, {"supplier": "Jae Auto Pte Ltd", "bill_no": "AR201710-07915", "bill_date": "13/10/2017", "make": "Unknown", "model": "— (chassis SLB2258H)", "doc_type": "Tax Invoice", "part_name": "HEADLAMP ASSY LH", "part_number": "JJ8301C341/8301A911", "qty": 1, "unit_cost": 350.0, "total_cost": 350.0}, {"supplier": "Jae Auto Pte Ltd", "bill_no": "AR201710-07915", "bill_date": "13/10/2017", "make": "Unknown", "model": "— (chassis SLB2258H)", "doc_type": "Tax Invoice", "part_name": "FACE,FR BUMPER", "part_number": "JJ6400H438", "qty": 1, "unit_cost": 600.0, "total_cost": 600.0}, {"supplier": "Jae Auto Pte Ltd", "bill_no": "AR201710-07915", "bill_date": "13/10/2017", "make": "Unknown", "model": "— (chassis SLB2258H)", "doc_type": "Tax Invoice", "part_name": "GRILLE,FR RADIATOR", "part_number": "JJ7450B019", "qty": 1, "unit_cost": 170.0, "total_cost": 170.0}, {"supplier": "Jae Auto Pte Ltd", "bill_no": "AR201710-07915", "bill_date": "13/10/2017", "make": "Unknown", "model": "— (chassis SLB2258H)", "doc_type": "Tax Invoice", "part_name": "CLIP,HOOD INSULATOR", "part_number": "JJMU001282", "qty": 8, "unit_cost": 2.0, "total_cost": 16.0}, {"supplier": "Jae Auto Pte Ltd", "bill_no": "AR201710-07915", "bill_date": "13/10/2017", "make": "Unknown", "model": "— (chassis SLB2258H)", "doc_type": "Tax Invoice", "part_name": "BRKT,FR BUMPER SIDE,L", "part_number": "JJ6400F549", "qty": 1, "unit_cost": 10.0, "total_cost": 10.0}, {"supplier": "Jae Auto Pte Ltd", "bill_no": "AR201710-07915", "bill_date": "13/10/2017", "make": "Unknown", "model": "— (chassis SLB2258H)", "doc_type": "Tax Invoice", "part_name": "GRILLE,FR BUMPER", "part_number": "JJ6402A399", "qty": 1, "unit_cost": 55.0, "total_cost": 55.0}, {"supplier": "Jae Auto Pte Ltd", "bill_no": "AR201710-07915", "bill_date": "13/10/2017", "make": "Unknown", "model": "— (chassis SLB2258H)", "doc_type": "Tax Invoice", "part_name": "GARNISH,FR BUMPER,CTR", "part_number": "JJ6402A402", "qty": 1, "unit_cost": 140.0, "total_cost": 140.0}, {"supplier": "Jae Auto Pte Ltd", "bill_no": "AR201710-07915", "bill_date": "13/10/2017", "make": "Unknown", "model": "— (chassis SLB2258H)", "doc_type": "Tax Invoice", "part_name": "REINFORCEMENT,FR BUMPER", "part_number": "JJ6400C639", "qty": 1, "unit_cost": 210.0, "total_cost": 210.0}, {"supplier": "Jae Auto Pte Ltd", "bill_no": "AR201710-07915", "bill_date": "13/10/2017", "make": "Unknown", "model": "— (chassis SLB2258H)", "doc_type": "Tax Invoice", "part_name": "REIN,FR BUMPER,UPR", "part_number": "JJ6400A832", "qty": 1, "unit_cost": 45.0, "total_cost": 45.0}, {"supplier": "Jae Auto Pte Ltd", "bill_no": "AR201710-07915", "bill_date": "13/10/2017", "make": "Unknown", "model": "— (chassis SLB2258H)", "doc_type": "Tax Invoice", "part_name": "GARNISH,FR BUMPER,LH(W/FOG LAMP)", "part_number": "JJ8321A689", "qty": 1, "unit_cost": 25.0, "total_cost": 25.0}, {"supplier": "Jae Auto Pte Ltd", "bill_no": "AR201710-07915", "bill_date": "13/10/2017", "make": "Unknown", "model": "— (chassis SLB2258H)", "doc_type": "Tax Invoice", "part_name": "LAMP ASSY,SIDE MARKER,LH", "part_number": "JJ8312A027", "qty": 1, "unit_cost": 350.0, "total_cost": 350.0}, {"supplier": "Jae Auto Pte Ltd", "bill_no": "AR201710-07915", "bill_date": "13/10/2017", "make": "Unknown", "model": "— (chassis SLB2258H)", "doc_type": "Tax Invoice", "part_name": "FR FENDER LH", "part_number": "JJ5220C527/G041", "qty": 1, "unit_cost": 280.0, "total_cost": 280.0}, {"supplier": "Jae Auto Pte Ltd", "bill_no": "AR201710-07915", "bill_date": "13/10/2017", "make": "Unknown", "model": "— (chassis SLB2258H)", "doc_type": "Tax Invoice", "part_name": "CLIP,FR BUMPER", "part_number": "JJMR288150", "qty": 8, "unit_cost": 2.0, "total_cost": 16.0}, {"supplier": "Jae Auto Pte Ltd", "bill_no": "AR201710-07915", "bill_date": "13/10/2017", "make": "Unknown", "model": "— (chassis SLB2258H)", "doc_type": "Tax Invoice", "part_name": "WEATHERSTRIP,HOOD", "part_number": "JJ5902A078", "qty": 1, "unit_cost": 18.0, "total_cost": 18.0}, {"supplier": "Jae Auto Pte Ltd", "bill_no": "AR201710-07915", "bill_date": "13/10/2017", "make": "Unknown", "model": "— (chassis SLB2258H)", "doc_type": "Tax Invoice", "part_name": "WEATHERSTRIP,HOOD,FR", "part_number": "JJ5902A021", "qty": 1, "unit_cost": 18.0, "total_cost": 18.0}, {"supplier": "Jae Auto Pte Ltd", "bill_no": "AR201710-07915", "bill_date": "13/10/2017", "make": "Unknown", "model": "— (chassis SLB2258H)", "doc_type": "Tax Invoice", "part_name": "COVER,FR BUMPER GRILLE,L", "part_number": "JJ6400H067", "qty": 1, "unit_cost": 5.0, "total_cost": 5.0}, {"supplier": "Jae Auto Pte Ltd", "bill_no": "AR201710-07915", "bill_date": "13/10/2017", "make": "Unknown", "model": "— (chassis SLB2258H)", "doc_type": "Tax Invoice", "part_name": "PANEL,H/LAMP SUPPORT,UPR", "part_number": "JJ5256A607", "qty": 1, "unit_cost": 150.0, "total_cost": 150.0}, {"supplier": "Jae Auto Pte Ltd", "bill_no": "AR201710-07915", "bill_date": "13/10/2017", "make": "Unknown", "model": "— (chassis SLB2258H)", "doc_type": "Tax Invoice", "part_name": "GROMMET,HEADLAMP", "part_number": "JJMN167828", "qty": 1, "unit_cost": 3.0, "total_cost": 3.0}, {"supplier": "Jae Auto Pte Ltd", "bill_no": "AR201806-02024", "bill_date": "04/06/2018", "make": "BMW", "model": "523i (F10)", "doc_type": "Tax Invoice", "part_name": "RR DOOR GLASS RH (51-357-182-118)", "part_number": "51357182118", "qty": 1, "unit_cost": 250.0, "total_cost": 250.0}, {"supplier": "Jae Auto Pte Ltd", "bill_no": "AR201806-15561", "bill_date": "29/06/2018", "make": "Toyota", "model": "Camry (ACV40/41)", "doc_type": "Tax Invoice", "part_name": "FRT FENDER RH (TH)", "part_number": "T53801-06130", "qty": 1, "unit_cost": 150.0, "total_cost": 150.0}, {"supplier": "Jae Auto Pte Ltd", "bill_no": "AR201806-15561", "bill_date": "29/06/2018", "make": "Toyota", "model": "Camry (ACV40/41)", "doc_type": "Tax Invoice", "part_name": "FRT FENDER LINER RH", "part_number": "T53875-06081", "qty": 1, "unit_cost": 65.0, "total_cost": 65.0}, {"supplier": "Jae Auto Pte Ltd", "bill_no": "AR201806-15561", "bill_date": "29/06/2018", "make": "Toyota", "model": "Camry (ACV40/41)", "doc_type": "Tax Invoice", "part_name": "HEAD LAMP RH 09\" (TH)", "part_number": "T81130-06590", "qty": 1, "unit_cost": 310.0, "total_cost": 310.0}, {"supplier": "Jae Auto Pte Ltd", "bill_no": "AR201806-15566", "bill_date": "29/06/2018", "make": "Toyota", "model": "Camry (ACV40/41)", "doc_type": "Tax Invoice", "part_name": "FRT BUMPER 09\"", "part_number": "T52119-06971", "qty": 1, "unit_cost": 190.0, "total_cost": 190.0}, {"supplier": "Jae Auto Pte Ltd", "bill_no": "AR201806-15566", "bill_date": "29/06/2018", "make": "Toyota", "model": "Camry (ACV40/41)", "doc_type": "Tax Invoice", "part_name": "CLIP FOR SHIELD", "part_number": "T90467-07166", "qty": 10, "unit_cost": 1.5, "total_cost": 15.0}, {"supplier": "Jae Auto Pte Ltd", "bill_no": "AR201806-15567", "bill_date": "29/06/2018", "make": "Toyota", "model": "Camry (ACV40/41)", "doc_type": "Tax Invoice", "part_name": "FRT BUMPER S/RETAINER RH 09\"", "part_number": "T52535-06100", "qty": 1, "unit_cost": 30.0, "total_cost": 30.0}, {"supplier": "Jae Auto Pte Ltd", "bill_no": "AR201804-15077", "bill_date": "27/04/2018", "make": "Audi", "model": "Q5 (8R)", "doc_type": "Tax Invoice", "part_name": "WIPER BLADES (ORIGINAL)", "part_number": "8R2998002", "qty": 1, "unit_cost": 60.0, "total_cost": 60.0}, {"supplier": "Jae Auto Pte Ltd", "bill_no": "AR201804-15077", "bill_date": "27/04/2018", "make": "Audi", "model": "Q5 (8R)", "doc_type": "Tax Invoice", "part_name": "RADIATOR LOWER BRACKET LH/RH", "part_number": "8K0805201", "qty": 2, "unit_cost": 20.0, "total_cost": 40.0}, {"supplier": "Jae Auto Pte Ltd", "bill_no": "AR201804-15077", "bill_date": "27/04/2018", "make": "Audi", "model": "Q5 (8R)", "doc_type": "Tax Invoice", "part_name": "RADIATOR SIDE AIR GUIDE LH", "part_number": "8R0121283P", "qty": 1, "unit_cost": 18.0, "total_cost": 18.0}, {"supplier": "Jae Auto Pte Ltd", "bill_no": "AR201804-15077", "bill_date": "27/04/2018", "make": "Audi", "model": "Q5 (8R)", "doc_type": "Tax Invoice", "part_name": "RADIATOR SIDE AIR GUIDE RH", "part_number": "8R0121284R", "qty": 1, "unit_cost": 18.0, "total_cost": 18.0}, {"supplier": "Jae Auto Pte Ltd", "bill_no": "AR201804-15077", "bill_date": "27/04/2018", "make": "Audi", "model": "Q5 (8R)", "doc_type": "Tax Invoice", "part_name": "FRONT BUMPER SIDE LOWER BRACKET LH", "part_number": "8R0807277C", "qty": 1, "unit_cost": 18.0, "total_cost": 18.0}, {"supplier": "Jae Auto Pte Ltd", "bill_no": "AR201804-15077", "bill_date": "27/04/2018", "make": "Audi", "model": "Q5 (8R)", "doc_type": "Tax Invoice", "part_name": "FRONT BUMPER SIDE LOWER BRACKET RH", "part_number": "8R0807278C", "qty": 1, "unit_cost": 18.0, "total_cost": 18.0}, {"supplier": "Jae Auto Pte Ltd", "bill_no": "AR201804-15077", "bill_date": "27/04/2018", "make": "Audi", "model": "Q5 (8R)", "doc_type": "Tax Invoice", "part_name": "RADIATOR GRILLE BRACKET", "part_number": "8R0807333A", "qty": 2, "unit_cost": 15.0, "total_cost": 30.0}, {"supplier": "Jae Auto Pte Ltd", "bill_no": "AR201804-15077", "bill_date": "27/04/2018", "make": "Audi", "model": "Q5 (8R)", "doc_type": "Tax Invoice", "part_name": "FRONT BUMPER SPONGE", "part_number": "8R0807550E", "qty": 1, "unit_cost": 45.0, "total_cost": 45.0}, {"supplier": "Jae Auto Pte Ltd", "bill_no": "AR201804-15077", "bill_date": "27/04/2018", "make": "Audi", "model": "Q5 (8R)", "doc_type": "Tax Invoice", "part_name": "FRONT WINDSCREEN SIDE MOULDING LH", "part_number": "8R0854327A 01C", "qty": 1, "unit_cost": 30.0, "total_cost": 30.0}, {"supplier": "He Xing Auto Glass Pte Ltd", "bill_no": "GLI8132395", "bill_date": "09/05/2018", "make": "Audi", "model": "Q5", "doc_type": "Tax Invoice", "part_name": "TAPE RAIN SENSOR", "part_number": "WAD 8U0-955-609", "qty": 1, "unit_cost": 50.0, "total_cost": 50.0}, {"supplier": "He Xing Auto Parts Pte Ltd", "bill_no": "DLI9201138", "bill_date": "23/03/2018", "make": "Volkswagen", "model": "—", "doc_type": "Tax Invoice", "part_name": "FR BUMPER", "part_number": "V5C5 807 217 J GRU", "qty": 1, "unit_cost": 550.0, "total_cost": 550.0}, {"supplier": "He Xing Auto Parts Pte Ltd", "bill_no": "DLI9201138", "bill_date": "23/03/2018", "make": "Volkswagen", "model": "—", "doc_type": "Tax Invoice", "part_name": "FR REINF", "part_number": "V5C5 807 109 D", "qty": 1, "unit_cost": 335.0, "total_cost": 335.0}, {"supplier": "He Xing Auto Parts Pte Ltd", "bill_no": "DLI9201138", "bill_date": "23/03/2018", "make": "Volkswagen", "model": "—", "doc_type": "Tax Invoice", "part_name": "BUMPER CLIP", "part_number": "VN 909 747 01", "qty": 10, "unit_cost": 3.5, "total_cost": 35.0}, {"supplier": "He Xing Auto Parts Pte Ltd", "bill_no": "DLI9204480", "bill_date": "19/06/2018", "make": "Toyota", "model": "—", "doc_type": "Tax Invoice", "part_name": "GRILLE ASSY", "part_number": "T53111-06130", "qty": 1, "unit_cost": 200.0, "total_cost": 200.0}, {"supplier": "He Xing Auto Parts Pte Ltd", "bill_no": "DLI9204480", "bill_date": "19/06/2018", "make": "Toyota", "model": "—", "doc_type": "Tax Invoice", "part_name": "INLET AIR DUCT", "part_number": "T17750-0H070", "qty": 1, "unit_cost": 85.0, "total_cost": 85.0}, {"supplier": "He Xing Auto Parts Pte Ltd", "bill_no": "DLI9204480", "bill_date": "19/06/2018", "make": "Toyota", "model": "—", "doc_type": "Tax Invoice", "part_name": "H LAMP RH UNIT -HID", "part_number": "T81145-06251", "qty": 1, "unit_cost": 450.0, "total_cost": 450.0}, {"supplier": "He Xing Auto Parts Pte Ltd", "bill_no": "DLI9204480", "bill_date": "19/06/2018", "make": "Toyota", "model": "—", "doc_type": "Tax Invoice", "part_name": "H LAMP LH UNIT -HID", "part_number": "T81185-06251", "qty": 1, "unit_cost": 450.0, "total_cost": 450.0}, {"supplier": "He Xing Auto Parts Pte Ltd", "bill_no": "DLI9204480", "bill_date": "19/06/2018", "make": "Toyota", "model": "—", "doc_type": "Tax Invoice", "part_name": "RADIATOR", "part_number": "T16400-0H260-K", "qty": 1, "unit_cost": 290.0, "total_cost": 290.0}, {"supplier": "He Xing Auto Parts Pte Ltd", "bill_no": "DLI9204480", "bill_date": "19/06/2018", "make": "Toyota", "model": "—", "doc_type": "Tax Invoice", "part_name": "BONNET ABSOR RH", "part_number": "T53440-0W110", "qty": 1, "unit_cost": 110.0, "total_cost": 110.0}, {"supplier": "He Xing Auto Parts Pte Ltd", "bill_no": "DLI9204480", "bill_date": "19/06/2018", "make": "Toyota", "model": "—", "doc_type": "Tax Invoice", "part_name": "BONNET ABSOR LH", "part_number": "T53450-0W090", "qty": 1, "unit_cost": 110.0, "total_cost": 110.0}, {"supplier": "He Xing Auto Parts Pte Ltd", "bill_no": "DLI9204480", "bill_date": "19/06/2018", "make": "Toyota", "model": "—", "doc_type": "Tax Invoice", "part_name": "BUMPER FR", "part_number": "T52119-06922", "qty": 1, "unit_cost": 185.0, "total_cost": 185.0}, {"supplier": "He Xing Auto Parts Pte Ltd", "bill_no": "MLI9048477", "bill_date": "27/02/2018", "make": "Chevrolet", "model": "Aveo", "doc_type": "Tax Invoice", "part_name": "HEAD LAMP RH (BLACK)", "part_number": "M92220436 / 92269223", "qty": 1, "unit_cost": 305.0, "total_cost": 305.0}, {"supplier": "Heng Hock Heng Auto Parts", "bill_no": "INV 00063684", "bill_date": "27/02/2018", "make": "Chevrolet", "model": "Aveo", "doc_type": "Tax Invoice", "part_name": "FRT RH FENDER", "part_number": "(SLF 8459 J CHEVY AVEO)", "qty": 1, "unit_cost": 195.0, "total_cost": 195.0}, {"supplier": "He Xing Auto Glass Pte Ltd", "bill_no": "GLI8133219", "bill_date": "18/06/2018", "make": "Toyota", "model": "Esquire", "doc_type": "Tax Invoice", "part_name": "W/S GLASS RR", "part_number": "WT68105-28700", "qty": 1, "unit_cost": 1050.0, "total_cost": 1050.0}, {"supplier": "Goldbell Engineering Pte Ltd", "bill_no": "GBE/SVC/SALES-3804/160324", "bill_date": "28/03/2016", "make": "Mitsubishi Fuso", "model": "Canter (FE)", "doc_type": "Repair Estimate (Merimen)", "part_name": "FRONT CABIN", "part_number": "MK710649", "qty": 1, "unit_cost": 18802.31, "total_cost": 18802.31}, {"supplier": "Goldbell Engineering Pte Ltd", "bill_no": "GBE/SVC/SALES-3804/160324", "bill_date": "28/03/2016", "make": "Mitsubishi Fuso", "model": "Canter (FE)", "doc_type": "Repair Estimate (Merimen)", "part_name": "FRONT PANEL GARNISH", "part_number": "MC978995", "qty": 1, "unit_cost": 362.24, "total_cost": 362.24}, {"supplier": "Goldbell Engineering Pte Ltd", "bill_no": "GBE/SVC/SALES-3804/160324", "bill_date": "28/03/2016", "make": "Mitsubishi Fuso", "model": "Canter (FE)", "doc_type": "Repair Estimate (Merimen)", "part_name": "RADIATOR GRILLE", "part_number": "MC978571", "qty": 1, "unit_cost": 1043.04, "total_cost": 1043.04}, {"supplier": "Goldbell Engineering Pte Ltd", "bill_no": "GBE/SVC/SALES-3804/160324", "bill_date": "28/03/2016", "make": "Mitsubishi Fuso", "model": "Canter (FE)", "doc_type": "Repair Estimate (Merimen)", "part_name": "RADIATOR GRILLE BRACKET", "part_number": "MK614805", "qty": 1, "unit_cost": 24.66, "total_cost": 24.66}, {"supplier": "Goldbell Engineering Pte Ltd", "bill_no": "GBE/SVC/SALES-3804/160324", "bill_date": "28/03/2016", "make": "Mitsubishi Fuso", "model": "Canter (FE)", "doc_type": "Repair Estimate (Merimen)", "part_name": "FRONT BUMPER", "part_number": "MC978516", "qty": 1, "unit_cost": 1010.33, "total_cost": 1010.33}, {"supplier": "Goldbell Engineering Pte Ltd", "bill_no": "GBE/SVC/SALES-3804/160324", "bill_date": "28/03/2016", "make": "Mitsubishi Fuso", "model": "Canter (FE)", "doc_type": "Repair Estimate (Merimen)", "part_name": "HEADLAMP (RHS/LHS)", "part_number": "MK580551", "qty": 2, "unit_cost": 501.41, "total_cost": 1002.82}, {"supplier": "Goldbell Engineering Pte Ltd", "bill_no": "GBE/SVC/SALES-3804/160324", "bill_date": "28/03/2016", "make": "Mitsubishi Fuso", "model": "Canter (FE)", "doc_type": "Repair Estimate (Merimen)", "part_name": "FRONT TURN SIGNAL LAMP (RHS)", "part_number": "MK580527", "qty": 1, "unit_cost": 532.72, "total_cost": 532.72}, {"supplier": "Goldbell Engineering Pte Ltd", "bill_no": "GBE/SVC/SALES-3804/160324", "bill_date": "28/03/2016", "make": "Mitsubishi Fuso", "model": "Canter (FE)", "doc_type": "Repair Estimate (Merimen)", "part_name": "FRONT WINDSCREEN WIPER MOTOR", "part_number": "MK581044", "qty": 1, "unit_cost": 655.49, "total_cost": 655.49}, {"supplier": "Goldbell Engineering Pte Ltd", "bill_no": "GBE/SVC/SALES-3804/160324", "bill_date": "28/03/2016", "make": "Mitsubishi Fuso", "model": "Canter (FE)", "doc_type": "Repair Estimate (Merimen)", "part_name": "HEATER ASSY", "part_number": "MK583365", "qty": 1, "unit_cost": 2315.34, "total_cost": 2315.34}, {"supplier": "Goldbell Engineering Pte Ltd", "bill_no": "GBE/SVC/SALES-3804/160324", "bill_date": "28/03/2016", "make": "Mitsubishi Fuso", "model": "Canter (FE)", "doc_type": "Repair Estimate (Merimen)", "part_name": "BLOWER ASSY", "part_number": "MK5833587", "qty": 1, "unit_cost": 821.12, "total_cost": 821.12}, {"supplier": "Goldbell Engineering Pte Ltd", "bill_no": "GBE/SVC/SALES-3804/160324", "bill_date": "28/03/2016", "make": "Mitsubishi Fuso", "model": "Canter (FE)", "doc_type": "Repair Estimate (Merimen)", "part_name": "AIRCOND CONDENSER", "part_number": "MK583297", "qty": 1, "unit_cost": 1397.66, "total_cost": 1397.66}, {"supplier": "Goldbell Engineering Pte Ltd", "bill_no": "GBE/SVC/SALES-3804/160324", "bill_date": "28/03/2016", "make": "Mitsubishi Fuso", "model": "Canter (FE)", "doc_type": "Repair Estimate (Merimen)", "part_name": "AIRCOND COMPRESSOR BACK BRACKET", "part_number": "MK583159", "qty": 1, "unit_cost": 782.1, "total_cost": 782.1}, {"supplier": "Goldbell Engineering Pte Ltd", "bill_no": "GBE/SVC/SALES-3804/160324", "bill_date": "28/03/2016", "make": "Mitsubishi Fuso", "model": "Canter (FE)", "doc_type": "Repair Estimate (Merimen)", "part_name": "DASHBOARD ASSY", "part_number": "MK569137", "qty": 1, "unit_cost": 1586.28, "total_cost": 1586.28}, {"supplier": "Goldbell Engineering Pte Ltd", "bill_no": "GBE/SVC/SALES-3804/160324", "bill_date": "28/03/2016", "make": "Mitsubishi Fuso", "model": "Canter (FE)", "doc_type": "Repair Estimate (Merimen)", "part_name": "RADIATOR ASSY", "part_number": "ME418713", "qty": 1, "unit_cost": 2616.07, "total_cost": 2616.07}, {"supplier": "Goldbell Engineering Pte Ltd", "bill_no": "GBE/SVC/SALES-3804/160324", "bill_date": "28/03/2016", "make": "Mitsubishi Fuso", "model": "Canter (FE)", "doc_type": "Repair Estimate (Merimen)", "part_name": "FRONT SEAT RHS", "part_number": "MK569860", "qty": 1, "unit_cost": 6030.9, "total_cost": 6030.9}, {"supplier": "Goldbell Engineering Pte Ltd", "bill_no": "GBE/SVC/SALES-3804/160324", "bill_date": "28/03/2016", "make": "Mitsubishi Fuso", "model": "Canter (FE)", "doc_type": "Repair Estimate (Merimen)", "part_name": "FRONT SEAT LHS", "part_number": "ML274082", "qty": 1, "unit_cost": 2898.72, "total_cost": 2898.72}, {"supplier": "Goldbell Engineering Pte Ltd", "bill_no": "GBE/SVC/SALES-3804/160324", "bill_date": "28/03/2016", "make": "Mitsubishi Fuso", "model": "Canter (FE)", "doc_type": "Repair Estimate (Merimen)", "part_name": "SENSOR & ACTUATOR MODULE,CONTROL UNIT", "part_number": "MK543399", "qty": 1, "unit_cost": 3448.37, "total_cost": 3448.37}, {"supplier": "Goldbell Engineering Pte Ltd", "bill_no": "GBE/SVC/SALES-3804/160324", "bill_date": "28/03/2016", "make": "Mitsubishi Fuso", "model": "Canter (FE)", "doc_type": "Repair Estimate (Merimen)", "part_name": "ENGINE CONTROL UNIT", "part_number": "MK667731", "qty": 1, "unit_cost": 14533.61, "total_cost": 14533.61}, {"supplier": "Goldbell Engineering Pte Ltd", "bill_no": "GBE/SVC/SALES-3804/160324", "bill_date": "28/03/2016", "make": "Mitsubishi Fuso", "model": "Canter (FE)", "doc_type": "Repair Estimate (Merimen)", "part_name": "GEAR ASSY, STEERING", "part_number": "T45380-25010", "qty": 1, "unit_cost": 920.8, "total_cost": 920.8}, {"supplier": "Borneo Motors (Singapore) Pte Ltd", "bill_no": "3624236-3624242 (WIP 29123)", "bill_date": "23/03/2018", "make": "Toyota", "model": "Hilux (KDY231R)", "doc_type": "Repair Estimate (Toyota/Borneo)", "part_name": "BAR SUB-ASSY, FR", "part_number": "T52101-25911", "qty": 1, "unit_cost": 427.8, "total_cost": 282.35}, {"supplier": "Borneo Motors (Singapore) Pte Ltd", "bill_no": "3624236-3624242 (WIP 29123)", "bill_date": "23/03/2018", "make": "Toyota", "model": "Hilux (KDY231R)", "doc_type": "Repair Estimate (Toyota/Borneo)", "part_name": "BRACKET", "part_number": "T75111-37010", "qty": 1, "unit_cost": 35.0, "total_cost": 23.1}, {"supplier": "Borneo Motors (Singapore) Pte Ltd", "bill_no": "3624236-3624242 (WIP 29123)", "bill_date": "23/03/2018", "make": "Toyota", "model": "Hilux (KDY231R)", "doc_type": "Repair Estimate (Toyota/Borneo)", "part_name": "CLIP, RADIATOR", "part_number": "T90467-06046 01", "qty": 10, "unit_cost": 2.5, "total_cost": 16.5}, {"supplier": "Borneo Motors (Singapore) Pte Ltd", "bill_no": "3624236-3624242 (WIP 29123)", "bill_date": "23/03/2018", "make": "Toyota", "model": "Hilux (KDY231R)", "doc_type": "Repair Estimate (Toyota/Borneo)", "part_name": "GRILLE, RADIATOR", "part_number": "T53114-37010", "qty": 1, "unit_cost": 500.0, "total_cost": 330.0}, {"supplier": "Borneo Motors (Singapore) Pte Ltd", "bill_no": "3624236-3624242 (WIP 29123)", "bill_date": "23/03/2018", "make": "Toyota", "model": "Hilux (KDY231R)", "doc_type": "Repair Estimate (Toyota/Borneo)", "part_name": "MOULDING, RADIATOR", "part_number": "T53121-37020", "qty": 1, "unit_cost": 47.8, "total_cost": 31.55}, {"supplier": "Borneo Motors (Singapore) Pte Ltd", "bill_no": "3624236-3624242 (WIP 29123)", "bill_date": "23/03/2018", "make": "Toyota", "model": "Hilux (KDY231R)", "doc_type": "Repair Estimate (Toyota/Borneo)", "part_name": "PROTECTOR, RADIATOR", "part_number": "T53119-37080 B0", "qty": 1, "unit_cost": 28.6, "total_cost": 18.88}, {"supplier": "Borneo Motors (Singapore) Pte Ltd", "bill_no": "3624236-3624242 (WIP 29123)", "bill_date": "23/03/2018", "make": "Toyota", "model": "Hilux (KDY231R)", "doc_type": "Repair Estimate (Toyota/Borneo)", "part_name": "ORNAMENT, FR PANEL", "part_number": "T75315-37011", "qty": 1, "unit_cost": 75.6, "total_cost": 49.9}, {"supplier": "Borneo Motors (Singapore) Pte Ltd", "bill_no": "3624236-3624242 (WIP 29123)", "bill_date": "23/03/2018", "make": "Toyota", "model": "Hilux (KDY231R)", "doc_type": "Repair Estimate (Toyota/Borneo)", "part_name": "PLATE, FR NAME, NO.1", "part_number": "T75311-25090", "qty": 1, "unit_cost": 65.0, "total_cost": 42.9}, {"supplier": "Borneo Motors (Singapore) Pte Ltd", "bill_no": "3624236-3624242 (WIP 29123)", "bill_date": "23/03/2018", "make": "Toyota", "model": "Hilux (KDY231R)", "doc_type": "Repair Estimate (Toyota/Borneo)", "part_name": "PLATE, FR FENDER", "part_number": "T75362-35090", "qty": 2, "unit_cost": 48.9, "total_cost": 64.54}, {"supplier": "Borneo Motors (Singapore) Pte Ltd", "bill_no": "3624236-3624242 (WIP 29123)", "bill_date": "23/03/2018", "make": "Toyota", "model": "Hilux (KDY231R)", "doc_type": "Repair Estimate (Toyota/Borneo)", "part_name": "PANEL SUB-ASSY", "part_number": "T55301-37012 B1", "qty": 1, "unit_cost": 932.6, "total_cost": 615.52}, {"supplier": "Borneo Motors (Singapore) Pte Ltd", "bill_no": "3624236-3624242 (WIP 29123)", "bill_date": "23/03/2018", "make": "Toyota", "model": "Hilux (KDY231R)", "doc_type": "Repair Estimate (Toyota/Borneo)", "part_name": "REINFORCEMENT ASSY", "part_number": "T55330-25020", "qty": 1, "unit_cost": 504.1, "total_cost": 332.71}, {"supplier": "Borneo Motors (Singapore) Pte Ltd", "bill_no": "3624236-3624242 (WIP 29123)", "bill_date": "23/03/2018", "make": "Toyota", "model": "Hilux (KDY231R)", "doc_type": "Repair Estimate (Toyota/Borneo)", "part_name": "PANEL, INSTRUMENT", "part_number": "T55411-25021 B1", "qty": 1, "unit_cost": 288.2, "total_cost": 190.21}, {"supplier": "Borneo Motors (Singapore) Pte Ltd", "bill_no": "3624236-3624242 (WIP 29123)", "bill_date": "23/03/2018", "make": "Toyota", "model": "Hilux (KDY231R)", "doc_type": "Repair Estimate (Toyota/Borneo)", "part_name": "GLASS, WINDSHIELD", "part_number": "T56111-37120", "qty": 1, "unit_cost": 1510.7, "total_cost": 997.06}, {"supplier": "Borneo Motors (Singapore) Pte Ltd", "bill_no": "3624236-3624242 (WIP 29123)", "bill_date": "23/03/2018", "make": "Toyota", "model": "Hilux (KDY231R)", "doc_type": "Repair Estimate (Toyota/Borneo)", "part_name": "GARNISH, FR PANEL", "part_number": "T53928-37011", "qty": 1, "unit_cost": 331.7, "total_cost": 218.92}, {"supplier": "Borneo Motors (Singapore) Pte Ltd", "bill_no": "3624236-3624242 (WIP 29123)", "bill_date": "23/03/2018", "make": "Toyota", "model": "Hilux (KDY231R)", "doc_type": "Repair Estimate (Toyota/Borneo)", "part_name": "PANEL ASSY, COWL FR", "part_number": "T55700-37310", "qty": 1, "unit_cost": 1026.9, "total_cost": 677.75}, {"supplier": "Borneo Motors (Singapore) Pte Ltd", "bill_no": "3624236-3624242 (WIP 29123)", "bill_date": "23/03/2018", "make": "Toyota", "model": "Hilux (KDY231R)", "doc_type": "Repair Estimate (Toyota/Borneo)", "part_name": "FENDER SUB-ASSY, RH", "part_number": "T53801-37021", "qty": 1, "unit_cost": 313.6, "total_cost": 206.98}, {"supplier": "Borneo Motors (Singapore) Pte Ltd", "bill_no": "3624236-3624242 (WIP 29123)", "bill_date": "23/03/2018", "make": "Toyota", "model": "Hilux (KDY231R)", "doc_type": "Repair Estimate (Toyota/Borneo)", "part_name": "FENDER SUB-ASSY, LH", "part_number": "T53802-37021", "qty": 1, "unit_cost": 313.6, "total_cost": 206.98}, {"supplier": "Borneo Motors (Singapore) Pte Ltd", "bill_no": "3624236-3624242 (WIP 29123)", "bill_date": "23/03/2018", "make": "Toyota", "model": "Hilux (KDY231R)", "doc_type": "Repair Estimate (Toyota/Borneo)", "part_name": "HEADLINING ASSY", "part_number": "T63310-37611 B0", "qty": 1, "unit_cost": 1487.4, "total_cost": 981.68}, {"supplier": "Borneo Motors (Singapore) Pte Ltd", "bill_no": "3624236-3624242 (WIP 29123)", "bill_date": "23/03/2018", "make": "Toyota", "model": "Hilux (KDY231R)", "doc_type": "Repair Estimate (Toyota/Borneo)", "part_name": "PANEL ASSY, FR DOOR", "part_number": "T67610-37130 B2", "qty": 1, "unit_cost": 476.3, "total_cost": 314.36}, {"supplier": "Borneo Motors (Singapore) Pte Ltd", "bill_no": "3624236-3624242 (WIP 29123)", "bill_date": "23/03/2018", "make": "Toyota", "model": "Hilux (KDY231R)", "doc_type": "Repair Estimate (Toyota/Borneo)", "part_name": "PANEL ASSY, FR DR RH", "part_number": "T67001-25051", "qty": 1, "unit_cost": 1721.0, "total_cost": 1135.86}, {"supplier": "Borneo Motors (Singapore) Pte Ltd", "bill_no": "3624236-3624242 (WIP 29123)", "bill_date": "23/03/2018", "make": "Toyota", "model": "Hilux (KDY231R)", "doc_type": "Repair Estimate (Toyota/Borneo)", "part_name": "HEADLAMP ASSY, RH", "part_number": "T81110-25221", "qty": 1, "unit_cost": 902.4, "total_cost": 595.58}, {"supplier": "Borneo Motors (Singapore) Pte Ltd", "bill_no": "3624236-3624242 (WIP 29123)", "bill_date": "23/03/2018", "make": "Toyota", "model": "Hilux (KDY231R)", "doc_type": "Repair Estimate (Toyota/Borneo)", "part_name": "HEADLAMP ASSY, LH", "part_number": "T81150-25221", "qty": 1, "unit_cost": 892.8, "total_cost": 589.25}, {"supplier": "Borneo Motors (Singapore) Pte Ltd", "bill_no": "3624236-3624242 (WIP 29123)", "bill_date": "23/03/2018", "make": "Toyota", "model": "Hilux (KDY231R)", "doc_type": "Repair Estimate (Toyota/Borneo)", "part_name": "METER ASSY", "part_number": "T83800-25B50", "qty": 1, "unit_cost": 1144.9, "total_cost": 755.63}, {"supplier": "Borneo Motors (Singapore) Pte Ltd", "bill_no": "3624236-3624242 (WIP 29123)", "bill_date": "23/03/2018", "make": "Toyota", "model": "Hilux (KDY231R)", "doc_type": "Repair Estimate (Toyota/Borneo)", "part_name": "GLASS SUB-ASSY, FR", "part_number": "T68101-37100", "qty": 1, "unit_cost": 725.9, "total_cost": 479.09}, {"supplier": "Borneo Motors (Singapore) Pte Ltd", "bill_no": "3624236-3624242 (WIP 29123)", "bill_date": "23/03/2018", "make": "Toyota", "model": "Hilux (KDY231R)", "doc_type": "Repair Estimate (Toyota/Borneo)", "part_name": "GEAR ASSY, STEERING", "part_number": "T45380-25010", "qty": 1, "unit_cost": 920.8, "total_cost": 607.73}];

/* ================= enrichment pipeline ================= */
function normPN(pn = "") {
  let p = String(pn).toUpperCase().trim();
  p = p.replace(/\(.*?\)/g, "").split("/")[0].replace(/\s*9{3,}$/, "").replace(/[\s\-.]/g, "");
  return p.trim();
}
const CAT_RULES = [
  ["Fog Lamp", ["fog lamp","fog"]], ["Signal/Marker Lamp", ["turn signal","signal len","side marker","ambient lamp"]],
  ["Headlamp", ["headlamp","head lamp","h lamp","h/lamp","hlamp"]], ["Bumper Reinforcement", ["reinforcment","reinforcement","reinf"]],
  ["Bumper Bracket/Retainer", ["bumper stay","bumper bracket","retainer","bumper side","sponge","lower bracket"]],
  ["Front Bumper", ["front bumper","frt bumper","fr bumper","face,fr bumper","bumper set","trim bumper","cover bumper","bumper 09","bumper fr"]],
  ["Bumper Cover/Tow", ["tow cover","cover towing","cover strip","spoiler"]], ["Grille", ["grille","garnish,fr bumper"]],
  ["Fender Liner/Mudguard", ["fender liner","wheel mud","mudguard","fender shield","mudflat","wheel house","wheel arch"]],
  ["Fender", ["fender","apron"]], ["Mirror", ["mirror"]], ["Glass", ["windshield","windscreen","w/s glass","fixed window","glass"]],
  ["Door Handle", ["door handle"]], ["Door Panel", ["door"]], ["Hood/Bonnet Hinge", ["bonnet hinge","hood hinge"]],
  ["Hood/Bonnet", ["hood","bonnet"]], ["Wiper", ["wiper"]], ["Absorber/Damper", ["absorber","damper","spring element"]],
  ["Sensor", ["sensor"]], ["Radiator Ancillary", ["radiator guide","air guide","radiator bracket","spare tank","reservoir","radiator clip"]],
  ["Radiator/Cooling", ["radiator","coolant","condenser","cooling fan","fan"]],
  ["Suspension/Steering Arm", ["tie rod","ball joint","lower arm","knuckle","control arm","stabilizer","anti roll","hub bearing","subframe"]],
  ["Steering Gear", ["steering gear","gear assy, steering","gear box"]],
  ["Structural Panel", ["cross member","panel sub-assy","reinforcement assy","chassis frame","pillar","bulkhead","support panel","valance","cowl","member"]],
  ["Seat", ["seat"]], ["Dashboard", ["dashboard","instrument","meter assy","console"]],
  ["Electronic Module", ["control unit","ecu","module","cable reel","airbag","antenna"]],
  ["Seal/Weatherstrip", ["weatherstrip","sealing","seal ","insulation"]], ["Lock/Mechanism", ["lock","hinge","stiffener"]],
  ["Consumable/Fastener", ["clip","rivet","bolt","screw"," nut","plug","grommet","treenail","tape","logo","mark","emblem","sticker","label","sundry"]],
];
function categorise(name = "") {
  const n = " " + String(name).toLowerCase() + " ";
  for (const [cat, keys] of CAT_RULES) if (keys.some((k) => n.includes(k))) return cat;
  return "Other";
}
const MAKE_PREFIX = [
  [/^MB[AN]/, "Mercedes-Benz"], [/^41588|^41582|^41580|^00088[28]/, "Mercedes-Benz"], [/^HY|^KA5/, "Hyundai"],
  [/^8[RK]|^4[GHFD]|^WAUZ/, "Audi"], [/^V5C5|^VN9|^VWV/, "Volkswagen"], [/^513/, "BMW"], [/^M9\d/, "Chevrolet"],
  [/^M[KCLEBRS]\d/, "Mitsubishi Fuso"], [/^T\d{4,}/, "Toyota"],
];
function inferMake(pn = "", billMake = "") {
  if (billMake && billMake !== "Unknown") return billMake;
  const p = normPN(pn);
  for (const [re, mk] of MAKE_PREFIX) if (re.test(p)) return mk;
  return billMake || "Unknown";
}
function lineType(docType = "", cat = "") {
  const d = String(docType).toLowerCase();
  if (d.includes("estimate")) return "Repair Estimate";
  if (cat === "Consumable/Fastener") return "Consumable / Fastener";
  if (d.includes("labour")) return "Labour";
  return "Supplier Part";
}
function enrichPart(raw) {
  const qty = Number(raw.qty) || 1;
  let unit = Number(raw.unit_cost);
  const total = Number(raw.total_cost) || (unit ? unit * qty : 0);
  if (!unit && total && qty) unit = +(total / qty).toFixed(2);
  const cat = categorise(raw.part_name);
  const make = inferMake(raw.part_number, raw.make);
  return {
    id: raw.id || crypto.randomUUID(), bill_no: raw.bill_no || "", supplier: raw.supplier || "", bill_date: raw.bill_date || "",
    make, model: raw.model || "—", part_name: raw.part_name || "", part_number: raw.part_number || "",
    npn: normPN(raw.part_number), cat, qty, unit, total, ltype: lineType(raw.doc_type, cat),
    doc_type: raw.doc_type || "Tax Invoice", src: raw.src || "excel",
  };
}
const median = (a) => { const s=[...a].sort((x,y)=>x-y); const m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2; };
const mean = (a) => a.reduce((x,y)=>x+y,0)/a.length;

/* ================= fuzzy name matching ================= */
const STOP = new Set(["assy","assembly","unit","fr","frt","front","rh","lh","l","r","w","o","the","of","for","with","09","and"]);
function normName(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/).filter((t) => t && !STOP.has(t)).join(" ").trim();
}
function toks(s) { return new Set(normName(s).split(" ").filter(Boolean)); }
function jaccard(a, b) { const A=toks(a),B=toks(b); let i=0; for(const x of A) if(B.has(x)) i++; const u=A.size+B.size-i; return u?i/u:0; }
function levSim(a, b) {
  a = normName(a); b = normName(b); const m=a.length,n=b.length;
  if (!m || !n) return 0;
  const d = Array.from({length:m+1},(_,i)=>[i,...Array(n).fill(0)]);
  for (let j=0;j<=n;j++) d[0][j]=j;
  for (let i=1;i<=m;i++) for (let j=1;j<=n;j++)
    d[i][j] = Math.min(d[i-1][j]+1, d[i][j-1]+1, d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
  return 1 - d[m][n]/Math.max(m,n,1);
}
// combined similarity, token weight configurable
function similarity(a, b, tokenWeight = 0.6) {
  return tokenWeight * jaccard(a, b) + (1 - tokenWeight) * levSim(a, b);
}

/* Cluster usable parts by configurable rules.
   cfg = { mode:'fuzzy-name'|'exact-pn'|'category', threshold, sameMake, tokenWeight } */
function buildClusters(parts, cfg) {
  const usable = parts.filter((p) => p.ltype === "Supplier Part");
  if (cfg.mode === "exact-pn") {
    const g = {};
    usable.forEach((p) => { const k=p.npn||"?"; (g[k]=g[k]||[]).push(p); });
    return Object.entries(g).map(([k, mem]) => makeCluster(mem, k));
  }
  if (cfg.mode === "category") {
    const g = {};
    usable.forEach((p) => { const k=(cfg.sameMake?p.make+" · ":"")+p.cat; (g[k]=g[k]||[]).push(p); });
    return Object.entries(g).map(([k, mem]) => makeCluster(mem, k));
  }
  // fuzzy-name greedy agglomeration
  const used = new Array(usable.length).fill(false);
  const clusters = [];
  for (let i = 0; i < usable.length; i++) {
    if (used[i]) continue; used[i] = true;
    const mem = [usable[i]];
    for (let j = i + 1; j < usable.length; j++) {
      if (used[j]) continue;
      if (cfg.sameMake && usable[i].make !== usable[j].make) continue;
      if (similarity(usable[i].part_name, usable[j].part_name, cfg.tokenWeight) >= cfg.threshold) {
        used[j] = true; mem.push(usable[j]);
      }
    }
    clusters.push(makeCluster(mem, usable[i].part_name));
  }
  return clusters.sort((a, b) => b.n - a.n);
}
function makeCluster(mem, label) {
  const units = mem.map((m) => m.unit);
  const names = [...new Set(mem.map((m) => m.part_name))];
  const pns = [...new Set(mem.map((m) => m.part_number).filter(Boolean))];
  const sup = [...new Set(mem.map((m) => m.supplier))];
  const med = median(units), av = mean(units);
  return {
    key: label, label: names[0] || label, names, pns, members: mem,
    make: mem[0].make, model: mem[0].model, cat: mem[0].cat, suppliers: sup,
    n: mem.length, min: Math.min(...units), med: +med.toFixed(2), avg: +av.toFixed(2),
    max: Math.max(...units), spread: +(Math.max(...units) - Math.min(...units)).toFixed(2),
    dates: mem.map((m) => m.bill_date).filter(Boolean),
  };
}
function parseDate(s) {
  const m = String(s).match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return null; let y = +m[3]; if (y < 100) y += 2000;
  return new Date(y, +m[2] - 1, +m[1]);
}

/* ================= persistence ================= */
const KEY = "partsindex_dataset_v3";
// Returns null when nothing has been stored yet (first run) so the app can seed the demo.
async function loadDS() {
  try { const v = localStorage.getItem(KEY); return v ? JSON.parse(v) : null; } catch { return null; }
}
async function saveDS(ds) { try { localStorage.setItem(KEY, JSON.stringify(ds)); } catch (e) { console.error(e); } }

/* ================= Claude OCR ================= */
const OCR_SYS = `You OCR Singapore motor-parts supplier invoices and repair estimates. Return ONLY a JSON object, no markdown. Schema:
{"supplier_name":str,"supplier_id":str,"bill_no":str,"bill_date":str,"repairer":str,"vehicle":str,"make":str,"model":str,"doc_type":"Tax Invoice"|"Repair Estimate","parts":[{"part_name":str,"part_number":str,"qty":num,"unit_cost":num,"total_cost":num}]}
Rules: extract every parts line, stitch page-split tables, exclude struck-through/returned/labour/GST/subtotal rows. unit_cost 0 if not printed. make/model only if printed or inferable from chassis. doc_type "Repair Estimate" only for repairer estimates.`;
async function ocrFile(base64, mediaType, isPdf) {
  const docBlock = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
    : { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } };
  // Routed through the serverless proxy (api/ocr.js) so the API key stays server-side.
  const res = await fetch("/api/ocr", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, system: OCR_SYS,
      messages: [{ role: "user", content: [docBlock, { type: "text", text: "Extract this invoice as JSON per the schema." }] }] }),
  });
  const data = await res.json();
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean.slice(clean.indexOf("{"), clean.lastIndexOf("}") + 1));
}
const fileToB64 = (file) => new Promise((res, rej) => {
  const r = new FileReader(); r.onload = () => res(r.result.split(",")[1]); r.onerror = rej; r.readAsDataURL(file);
});

/* ================= flexible Excel mapping ================= */
function col(headers, ...needles) {
  const h = headers.map((x) => String(x).toLowerCase());
  for (const n of needles) { const i = h.findIndex((x) => n.every((w) => x.includes(w))); if (i >= 0) return i; }
  return -1;
}
function parseExcel(wb) {
  const out = [];
  wb.SheetNames.forEach((sn) => {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, blankrows: false });
    let hi = rows.findIndex((r) => r && r.some((c) => /part/i.test(String(c))) && r.some((c) => /(number|no\.?|part no)/i.test(String(c))));
    if (hi < 0) return;
    const H = rows[hi];
    const iName=col(H,["part","name"],["particular"],["descript"]), iNo=col(H,["part","number"],["part","no"],["stockid"],["part no"]);
    const iQty=col(H,["qty"],["quant"]), iUnit=col(H,["unit"],["u/price"],["u.price"]), iTot=col(H,["total"],["amount"],["line"]);
    const iSup=col(H,["supplier"]), iMake=col(H,["make"]), iModel=col(H,["model"]);
    const iBill=col(H,["bill","no"],["invoice","no"],["bill ref"]), iDate=col(H,["date"]), iDoc=col(H,["doc","type"],["line","type"]);
    if (iName < 0 && iNo < 0) return;
    for (let r = hi + 1; r < rows.length; r++) {
      const row = rows[r]; if (!row) continue;
      const name = iName >= 0 ? row[iName] : "", no = iNo >= 0 ? row[iNo] : "";
      if (!name && !no) continue;
      out.push({ part_name: name, part_number: no, qty: iQty>=0?row[iQty]:1, unit_cost: iUnit>=0?row[iUnit]:0,
        total_cost: iTot>=0?row[iTot]:0, supplier: iSup>=0?row[iSup]:(sn||""), make: iMake>=0?row[iMake]:"",
        model: iModel>=0?row[iModel]:"", bill_no: iBill>=0?row[iBill]:"", bill_date: iDate>=0?row[iDate]:"",
        doc_type: iDoc>=0?row[iDoc]:"Tax Invoice", src: "excel" });
    }
  });
  return out;
}

/* ================= App ================= */
export default function App() {
  const [ds, setDs] = useState({ parts: [] });
  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(null);
  const [log, setLog] = useState([]);
  const [q, setQ] = useState(""), [fMake, setFMake] = useState("All"), [fType, setFType] = useState("All");
  const [cfg, setCfg] = useState({ mode: "fuzzy-name", threshold: 0.65, sameMake: true, tokenWeight: 0.6 });
  const [method, setMethod] = useState("benchmark");
  const [inflPct, setInflPct] = useState(30);
  const excelRef = useRef(), invRef = useRef();

  useEffect(() => {
    loadDS().then((stored) => {
      if (stored && Array.isArray(stored.parts)) { setDs(stored); }      // returning user (incl. explicitly cleared)
      else { const seeded = { parts: DEMO_18.map(enrichPart) }; setDs(seeded); saveDS(seeded); } // first run -> demo
    });
  }, []);
  const commit = useCallback((next) => { setDs(next); saveDS(next); }, []);
  const addLog = (m) => setLog((L) => [`${new Date().toLocaleTimeString()}  ${m}`, ...L].slice(0, 40));
  const addRaw = (raws, label) => { const enr = raws.map(enrichPart); commit({ parts: [...ds.parts, ...enr] }); addLog(`+${enr.length} parts from ${label}`); };

  const onExcel = async (e) => {
    const files = [...e.target.files]; if (!files.length) return; setLoading("Reading spreadsheets…");
    try { for (const f of files) { const wb = XLSX.read(await f.arrayBuffer(), { type: "array" }); addRaw(parseExcel(wb), f.name); } }
    catch (err) { addLog(`Excel error: ${err.message}`); } setLoading(null); e.target.value = "";
  };
  const onInvoice = async (e) => {
    const files = [...e.target.files]; if (!files.length) return;
    for (const f of files) { setLoading(`OCR: ${f.name}…`);
      try { const b64 = await fileToB64(f); const isPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
        const j = await ocrFile(b64, f.type || "image/png", isPdf);
        const meta = { supplier: j.supplier_name, bill_no: j.bill_no, bill_date: j.bill_date, make: j.make, model: j.model, doc_type: j.doc_type };
        addRaw((j.parts || []).map((p) => ({ ...p, ...meta, src: "ocr" })), f.name);
      } catch (err) { addLog(`OCR failed for ${f.name}: ${err.message}`); } }
    setLoading(null); e.target.value = "";
  };
  const loadDemo = () => { commit({ parts: DEMO_18.map(enrichPart) }); addLog("Loaded demo: 18 sample bills (174 lines)"); };
  const clearAll = () => { if (window.confirm("Remove all stored parts?")) { commit({ parts: [] }); addLog("Dataset cleared"); } };

  const parts = ds.parts;
  const clusters = useMemo(() => buildClusters(parts, cfg), [parts, cfg]);
  const makes = useMemo(() => ["All", ...[...new Set(parts.map((p) => p.make))].sort()], [parts]);
  const filtered = useMemo(() => parts.filter((p) =>
    (fMake === "All" || p.make === fMake) && (fType === "All" || p.ltype === fType) &&
    (!q || (p.part_name + p.part_number + p.supplier).toLowerCase().includes(q.toLowerCase()))
  ), [parts, q, fMake, fType]);
  const kpis = useMemo(() => {
    const usable = parts.filter((p) => p.ltype === "Supplier Part");
    return { invoices: new Set(parts.map((p) => p.bill_no).filter(Boolean)).size, lines: parts.length,
      usable: usable.length, makes: new Set(usable.map((p) => p.make)).size,
      clusters: clusters.length, ready: clusters.filter((c) => c.n > 1).length };
  }, [parts, clusters]);

  const exportXlsx = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(parts.map(({ id, src, ...r }) => r)), "Parts DB");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clusters.map((c) => ({
      Cluster: c.label, Make: c.make, Category: c.cat, Quotes: c.n, Variants: c.names.join(" | "),
      Suppliers: c.suppliers.join(", "), Min: c.min, Median: c.med, Average: c.avg, Max: c.max })) ), "Benchmark");
    XLSX.writeFile(wb, "PartsIndex_export.xlsx");
  };

  const Tab = ({ id, label }) => (
    <button onClick={() => setTab(id)} style={{ padding: "12px 18px", background: "none", border: "none", cursor: "pointer",
      color: tab === id ? "#fff" : MUTE, fontWeight: tab === id ? 700 : 500, fontSize: 13,
      borderBottom: tab === id ? `3px solid ${LIME}` : "3px solid transparent", letterSpacing: ".02em" }}>{label}</button>
  );

  return (
    <div style={{ minHeight: "100vh", background: INK, color: TEXT, fontFamily: "'Inter',system-ui,sans-serif" }}>
      <div style={{ background: TEAL_D, padding: "16px 26px", display: "flex", alignItems: "center", gap: 15 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: LIME, display: "grid", placeItems: "center", color: TEAL_D, fontWeight: 900, fontSize: 19 }}>P</div>
        <div><div style={{ fontSize: 18, fontWeight: 800 }}>PartsIndex</div>
          <div style={{ fontSize: 11, color: "#BFE6EF" }}>Parts Pricing Reference for SG Motor Third-Party Claims</div></div>
        <div style={{ flex: 1 }} />
        {loading
          ? <div style={{ fontSize: 12, color: LIME, display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 8, height: 8, borderRadius: 8, background: LIME, animation: "pulse 1s infinite" }} />{loading}</div>
          : <div style={{ fontSize: 11, color: "#BFE6EF", textAlign: "right" }}>Powered by Merimen Claims Data<br /><span style={{ opacity: .7 }}>fuzzy-matched median benchmark</span></div>}
      </div>
      <div style={{ background: TEAL, padding: "0 18px", display: "flex", gap: 2, flexWrap: "wrap" }}>
        <Tab id="dashboard" label="Dashboard" /><Tab id="upload" label="Ingest" />
        <Tab id="parts" label="Parts Ledger" /><Tab id="bench" label="Benchmark" /><Tab id="analytics" label="Analytics" />
        <Tab id="coverage" label="Coverage" /><Tab id="methods" label="Method Notes" />
      </div>

      <div style={{ padding: 26, maxWidth: 1240, margin: "0 auto" }}>
        {tab === "dashboard" && <Dashboard parts={parts} clusters={clusters} kpis={kpis} onDemo={loadDemo} onGo={() => setTab("upload")} />}
        {tab === "upload" && <Ingest {...{ excelRef, invRef, onExcel, onInvoice, loadDemo, exportXlsx, clearAll, parts, log }} />}
        {tab === "parts" && <Ledger {...{ q, setQ, fMake, setFMake, fType, setFType, makes, filtered }} />}
        {tab === "bench" && <Benchmark {...{ cfg, setCfg, clusters }} />}
        {tab === "analytics" && <Analytics {...{ parts, clusters, cfg, method, setMethod, inflPct, setInflPct }} />}
        {tab === "coverage" && <Coverage {...{ parts, clusters }} />}
        {tab === "methods" && <MethodNotes />}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}} *{box-sizing:border-box} ::selection{background:${LIME};color:${TEAL_D}}
        input[type=range]{accent-color:${LIME}}`}</style>
    </div>
  );
}

/* ---------- shared bits ---------- */
const btn = (bg, fg) => ({ marginTop: 14, padding: "10px 16px", background: bg, color: fg, border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" });
const inp = (w) => ({ width: w, padding: "9px 11px", background: "#082430", color: TEXT, border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 12.5, outline: "none" });
const th = { textAlign: "left", padding: "10px 12px", fontSize: 11, color: MUTE, fontWeight: 700, whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: ".04em" };
const td = { padding: "8px 12px", whiteSpace: "nowrap" };
function Card({ title, children, span }) {
  return <div style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 12, padding: 18, gridColumn: span }}>
    {title && <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: "#fff" }}>{title}</div>}{children}</div>;
}
// Shared drill-down: lists the individual quotes behind a benchmark cluster.
function QuoteLines({ c }) {
  return (<>{c.members.map((m, k) => (
    <div key={k} style={{ padding: "2px 0" }}>
      <span style={{ color: TEXT }}>{m.part_name}</span> · <span style={{ fontFamily: "ui-monospace,monospace" }}>{m.part_number || "—"}</span> · {m.supplier} · <b style={{ color: LIME }}>S${m.unit}</b>{m.bill_date ? " · " + m.bill_date : ""}
    </div>))}</>);
}

function Dashboard({ parts, clusters, kpis, onDemo, onGo }) {
  const [openTop, setOpenTop] = useState(null);
  return (<>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 22 }}>
      {[["Invoices", kpis.invoices, TEAL_L], ["Part lines", kpis.lines, "#fff"], ["Usable supplier parts", kpis.usable, "#fff"],
        ["Fuzzy clusters", kpis.clusters, "#fff"], ["Makes covered", kpis.makes, "#fff"], ["Benchmark-ready", kpis.ready, LIME]]
        .map(([l, v, c]) => (
        <div key={l} style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 10, padding: "16px 18px" }}>
          <div style={{ fontSize: 30, fontWeight: 800, color: c, lineHeight: 1 }}>{v}</div>
          <div style={{ fontSize: 11.5, color: MUTE, marginTop: 6 }}>{l}</div></div>))}
    </div>
    {parts.length === 0 ? (
      <div style={{ border: `1px dashed ${LINE}`, borderRadius: 12, padding: 44, textAlign: "center", background: PANEL }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: "#fff" }}>No parts stored yet</div>
        <div style={{ color: MUTE, fontSize: 13, maxWidth: 470, margin: "0 auto 20px", lineHeight: 1.6 }}>
          Bring in the supplier bills, or load the 18-bill demo set to explore the analytics right away.</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button onClick={onGo} style={btn(LIME, TEAL_D)}>Go to Ingest</button>
          <button onClick={onDemo} style={btn(ICE, TEAL_D)}>Load demo (18 bills)</button></div>
      </div>
    ) : (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card title="Coverage vs common SG makes">
          {SG_MAKES.map((m) => { const n = parts.filter((p) => p.make === m && p.ltype === "Supplier Part").length;
            return (<div key={m} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", fontSize: 12.5 }}>
              <span style={{ width: 120, color: n ? TEXT : MUTE }}>{m}</span>
              <div style={{ flex: 1, height: 7, background: "#0A2C38", borderRadius: 5, overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, n * 6)}%`, height: "100%", background: n ? LIME : "transparent" }} /></div>
              <span style={{ width: 28, textAlign: "right", color: MUTE }}>{n || "—"}</span></div>); })}
        </Card>
        <Card title="Top fuzzy-matched benchmarks (≥2 quotes)">
          {clusters.filter((c) => c.n > 1).slice(0, 10).map((c, i) => {
            const id = c.key + i, isOpen = openTop === id;
            return (
              <div key={id} style={{ borderBottom: `1px solid ${LINE}` }}>
                <div onClick={() => setOpenTop(isOpen ? null : id)} style={{ padding: "7px 0", fontSize: 12.5, cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 600 }}><span style={{ color: LIME, marginRight: 6 }}>{isOpen ? "▾" : "▸"}</span>{c.label}</span>
                    <span style={{ color: LIME, fontWeight: 700 }}>S${c.med}</span></div>
                  <div style={{ color: MUTE, fontSize: 11, paddingLeft: 16 }}>{c.make} · {c.n} quotes · {c.suppliers.length} suppliers · range S${c.min}–{c.max}</div></div>
                {isOpen && <div style={{ padding: "2px 0 8px 16px", fontSize: 11, color: MUTE }}><QuoteLines c={c} /></div>}
              </div>); })}
          {clusters.filter((c) => c.n > 1).length === 0 &&
            <div style={{ color: MUTE, fontSize: 12.5, lineHeight: 1.6 }}>No clusters with 2+ quotes at the current matching setting. Loosen the threshold on the Benchmark tab.</div>}
        </Card>
      </div>
    )}
  </>);
}

function Ingest({ excelRef, invRef, onExcel, onInvoice, loadDemo, exportXlsx, clearAll, parts, log }) {
  return (<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
    <Card title="Bulk upload · Claude-OCR'd Excel">
      <p style={{ color: MUTE, fontSize: 12.5, lineHeight: 1.6 }}>Drop one or many .xlsx / .csv exports. Columns are matched flexibly (Part Name, Part No, Qty, Unit, Total, Supplier, Make, Model, Bill No, Date).</p>
      <input ref={excelRef} type="file" accept=".xlsx,.xls,.csv" multiple onChange={onExcel} style={{ display: "none" }} />
      <button onClick={() => excelRef.current.click()} style={btn(LIME, TEAL_D)}>Choose spreadsheets</button></Card>
    <Card title="OCR invoices · live via Claude">
      <p style={{ color: MUTE, fontSize: 12.5, lineHeight: 1.6 }}>Upload raw invoice PDFs or images. Each is read by Claude, extracted to structured parts, enriched and stored.</p>
      <input ref={invRef} type="file" accept=".pdf,image/*" multiple onChange={onInvoice} style={{ display: "none" }} />
      <button onClick={() => invRef.current.click()} style={btn(TEAL_L, "#fff")}>Choose invoices to OCR</button>
      <p style={{ color: MUTE, fontSize: 11, marginTop: 10 }}>In a deployed static site, route this through a serverless proxy so the API key stays server-side.</p></Card>
    <Card title="Dataset actions">
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button onClick={loadDemo} style={btn(ICE, TEAL_D)}>Load demo (18 bills)</button>
        <button onClick={exportXlsx} style={btn("#123E4D", TEXT)} disabled={!parts.length}>Export .xlsx</button>
        <button onClick={clearAll} style={btn("#3A2226", "#F3B4B0")} disabled={!parts.length}>Clear dataset</button></div>
      <p style={{ color: MUTE, fontSize: 11.5, marginTop: 12 }}>Saved to persistent storage; reloads automatically next session.</p></Card>
    <Card title="Activity">
      <div style={{ maxHeight: 180, overflow: "auto", fontSize: 11.5, fontFamily: "ui-monospace,monospace", color: MUTE }}>
        {log.length ? log.map((l, i) => <div key={i} style={{ padding: "2px 0" }}>{l}</div>) : <span>No activity yet.</span>}</div></Card>
  </div>);
}

function Ledger({ q, setQ, fMake, setFMake, fType, setFType, makes, filtered }) {
  return (<>
    <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
      <input placeholder="Search part / number / supplier" value={q} onChange={(e) => setQ(e.target.value)} style={inp(240)} />
      <select value={fMake} onChange={(e) => setFMake(e.target.value)} style={inp(160)}>{makes.map((m) => <option key={m}>{m}</option>)}</select>
      <select value={fType} onChange={(e) => setFType(e.target.value)} style={inp(200)}>
        {["All", "Supplier Part", "Consumable / Fastener", "Repair Estimate", "Labour"].map((t) => <option key={t}>{t}</option>)}</select>
      <span style={{ color: MUTE, fontSize: 12.5, alignSelf: "center" }}>{filtered.length} rows</span></div>
    <div style={{ overflow: "auto", border: `1px solid ${LINE}`, borderRadius: 10 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead><tr style={{ background: PANEL }}>{["Make","Category","Part name","Part no","Qty","Unit S$","Total S$","Line type","Supplier"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>{filtered.slice(0, 400).map((p) => (
          <tr key={p.id} style={{ borderTop: `1px solid ${LINE}`, background: p.ltype === "Repair Estimate" ? "#3A2226" : p.ltype.startsWith("Consumable") ? "#0C2E3A" : "transparent" }}>
            <td style={td}>{p.make}</td><td style={td}>{p.cat}</td><td style={{ ...td, fontWeight: 600 }}>{p.part_name}</td>
            <td style={{ ...td, fontFamily: "ui-monospace,monospace", color: MUTE }}>{p.part_number}</td>
            <td style={{ ...td, textAlign: "center" }}>{p.qty}</td><td style={{ ...td, textAlign: "right" }}>{p.unit?.toFixed(2)}</td>
            <td style={{ ...td, textAlign: "right" }}>{p.total?.toFixed(2)}</td><td style={{ ...td, color: MUTE }}>{p.ltype}</td><td style={{ ...td, color: MUTE }}>{p.supplier}</td></tr>))}</tbody></table>
      {filtered.length > 400 && <div style={{ padding: 10, color: MUTE, fontSize: 12 }}>Showing first 400 of {filtered.length}.</div>}</div>
  </>);
}

/* ---------- Benchmark with configurable fuzzy matcher ---------- */
function Benchmark({ cfg, setCfg, clusters }) {
  const [open, setOpen] = useState(null);
  const set = (k, v) => setCfg({ ...cfg, [k]: v });
  return (<>
    <Card title="Matching configuration">
      <div style={{ display: "flex", gap: 26, flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ fontSize: 12.5 }}>Mode&nbsp;
          <select value={cfg.mode} onChange={(e) => set("mode", e.target.value)} style={inp(150)}>
            <option value="fuzzy-name">Fuzzy part name</option><option value="category">Category + make</option><option value="exact-pn">Exact part no</option>
          </select></label>
        <label style={{ fontSize: 12.5, opacity: cfg.mode === "fuzzy-name" ? 1 : .4 }}>Similarity threshold: <b style={{ color: LIME }}>{cfg.threshold.toFixed(2)}</b><br />
          <input type="range" min="0.4" max="0.95" step="0.05" value={cfg.threshold} disabled={cfg.mode !== "fuzzy-name"} onChange={(e) => set("threshold", +e.target.value)} style={{ width: 180 }} /></label>
        <label style={{ fontSize: 12.5, opacity: cfg.mode === "fuzzy-name" ? 1 : .4 }}>Token vs spelling weight: <b style={{ color: LIME }}>{cfg.tokenWeight.toFixed(1)}</b><br />
          <input type="range" min="0" max="1" step="0.1" value={cfg.tokenWeight} disabled={cfg.mode !== "fuzzy-name"} onChange={(e) => set("tokenWeight", +e.target.value)} style={{ width: 150 }} /></label>
        <label style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={cfg.sameMake} onChange={(e) => set("sameMake", e.target.checked)} /> Only match within same make</label>
      </div>
      <p style={{ color: MUTE, fontSize: 11.5, marginTop: 10, lineHeight: 1.5 }}>Higher threshold = stricter (fewer, tighter clusters). Token weight leans on shared words (good for "HEAD LAMP" vs "HEADLAMP ASSY"); spelling weight leans on character edits. Exact-PN reproduces the strict behaviour.</p>
    </Card>
    <p style={{ color: MUTE, fontSize: 12.5, margin: "14px 0", lineHeight: 1.6 }}><b style={{ color: LIME }}>Median</b> is the reference. Lime rows have ≥2 quotes. Click a row to see the grouped variants.</p>
    <div style={{ overflow: "auto", border: `1px solid ${LINE}`, borderRadius: 10 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead><tr style={{ background: PANEL }}>{["Benchmark part","Make","Category","Quotes","Suppliers","Min","Median","Avg","Max","Spread"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>{clusters.slice(0, 400).map((c, i) => (
          <React.Fragment key={c.key + i}>
            <tr onClick={() => setOpen(open === c.key + i ? null : c.key + i)} style={{ borderTop: `1px solid ${LINE}`, cursor: "pointer", background: c.n > 1 ? "rgba(195,215,0,.12)" : "transparent" }}>
              <td style={{ ...td, fontWeight: 600 }}>{c.label}{c.names.length > 1 && <span style={{ color: MUTE, fontWeight: 400 }}> +{c.names.length - 1}</span>}</td>
              <td style={td}>{c.make}</td><td style={{ ...td, color: MUTE }}>{c.cat}</td>
              <td style={{ ...td, textAlign: "center", fontWeight: c.n > 1 ? 800 : 400, color: c.n > 1 ? LIME : TEXT }}>{c.n}</td>
              <td style={{ ...td, color: MUTE }}>{c.suppliers.length}</td>
              <td style={{ ...td, textAlign: "right", color: MUTE }}>{c.min}</td>
              <td style={{ ...td, textAlign: "right", fontWeight: 800, color: LIME }}>{c.med}</td>
              <td style={{ ...td, textAlign: "right" }}>{c.avg}</td><td style={{ ...td, textAlign: "right", color: MUTE }}>{c.max}</td>
              <td style={{ ...td, textAlign: "right", color: c.spread > 0 ? RED : MUTE }}>{c.spread || "—"}</td></tr>
            {open === c.key + i && (
              <tr style={{ background: "#082430" }}><td colSpan={10} style={{ padding: "8px 14px", fontSize: 11.5, color: MUTE }}>
                <QuoteLines c={c} /></td></tr>)}
          </React.Fragment>))}</tbody></table></div>
  </>);
}

/* ---------- Analytics: all 8 methods, selectable ---------- */
const METHODS = [
  ["benchmark", "Median benchmark"], ["inflation", "Inflation flagging"], ["confidence", "Confidence scoring"],
  ["dispersion", "Supplier dispersion"], ["trend", "Price trend"], ["agreement", "Cross-source agreement"],
  ["accuracy", "Accuracy validation"], ["normalisation", "Normalisation view"],
];
function Analytics({ parts, clusters, cfg, method, setMethod, inflPct, setInflPct }) {
  return (<>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
      {METHODS.map(([id, label], i) => (
        <button key={id} onClick={() => setMethod(id)} style={{ padding: "8px 13px", borderRadius: 8, cursor: "pointer", fontSize: 12.5, fontWeight: method === id ? 700 : 500,
          background: method === id ? LIME : "#0F3543", color: method === id ? TEAL_D : MUTE, border: `1px solid ${method === id ? LIME : LINE}` }}>
          <span style={{ fontFamily: "ui-monospace,monospace", opacity: .7, marginRight: 6 }}>{String(i + 1).padStart(2, "0")}</span>{label}</button>))}
    </div>
    {method === "benchmark" && <MBenchmark clusters={clusters} />}
    {method === "inflation" && <MInflation clusters={clusters} inflPct={inflPct} setInflPct={setInflPct} />}
    {method === "confidence" && <MConfidence clusters={clusters} />}
    {method === "dispersion" && <MDispersion clusters={clusters} />}
    {method === "trend" && <MTrend parts={parts} />}
    {method === "agreement" && <MAgreement clusters={clusters} />}
    {method === "accuracy" && <MAccuracy parts={parts} />}
    {method === "normalisation" && <MNormalisation clusters={clusters} />}
  </>);
}
function Head({ children }) { return <p style={{ color: MUTE, fontSize: 12.5, lineHeight: 1.65, marginBottom: 14, maxWidth: 780 }}>{children}</p>; }
function Tbl({ cols, rows }) {
  return <div style={{ overflow: "auto", border: `1px solid ${LINE}`, borderRadius: 10 }}>
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
      <thead><tr style={{ background: PANEL }}>{cols.map((c) => <th key={c.k} style={{ ...th, textAlign: c.a || "left" }}>{c.h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i} style={{ borderTop: `1px solid ${LINE}`, background: r._bg || "transparent" }}>
        {cols.map((c) => <td key={c.k} style={{ ...td, textAlign: c.a || "left", color: c.mut ? MUTE : (r["_c" + c.k] || TEXT), fontFamily: c.mono ? "ui-monospace,monospace" : "inherit", fontWeight: c.b ? 700 : 400 }}>{r[c.k]}</td>)}</tr>)}</tbody></table></div>;
}
function MBenchmark({ clusters }) {
  const [open, setOpen] = useState(null);
  const ready = clusters.filter((c) => c.n > 1);
  const rows = ready.length ? ready : clusters.slice(0, 25);
  const heads = [["Benchmark part","left"],["Make","left"],["Quotes","center"],["Median S$","right"],["Avg S$","right"],["Range S$","right"]];
  return (<><Head>The core reference: median unit price per fuzzy-matched part cluster. Median resists a single inflated bill; average is shown so reviewers can see skew. Only clusters with 2+ quotes give a defensible benchmark. Click a part to see its quotes.</Head>
    <div style={{ overflow: "auto", border: `1px solid ${LINE}`, borderRadius: 10 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead><tr style={{ background: PANEL }}>{heads.map(([h,a]) => <th key={h} style={{ ...th, textAlign: a }}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((c, i) => { const id = c.key + i, isOpen = open === id; return (
          <React.Fragment key={id}>
            <tr onClick={() => setOpen(isOpen ? null : id)} style={{ borderTop: `1px solid ${LINE}`, cursor: "pointer", background: c.n > 1 ? "rgba(195,215,0,.10)" : "transparent" }}>
              <td style={{ ...td, fontWeight: 600 }}><span style={{ color: LIME, marginRight: 6 }}>{isOpen ? "▾" : "▸"}</span>{c.label}{c.names.length > 1 && <span style={{ color: MUTE, fontWeight: 400 }}> +{c.names.length - 1}</span>}</td>
              <td style={td}>{c.make}</td>
              <td style={{ ...td, textAlign: "center", fontWeight: c.n > 1 ? 800 : 400, color: c.n > 1 ? LIME : TEXT }}>{c.n}</td>
              <td style={{ ...td, textAlign: "right", fontWeight: 800, color: LIME }}>{c.med}</td>
              <td style={{ ...td, textAlign: "right" }}>{c.avg}</td>
              <td style={{ ...td, textAlign: "right", color: MUTE }}>{c.min}–{c.max}</td></tr>
            {isOpen && <tr style={{ background: "#082430" }}><td colSpan={6} style={{ padding: "8px 14px", fontSize: 11.5, color: MUTE }}><QuoteLines c={c} /></td></tr>}
          </React.Fragment>); })}</tbody></table></div></>);
}
function MInflation({ clusters, inflPct, setInflPct }) {
  const rows = [];
  clusters.filter((c) => c.n > 1).forEach((c) => c.members.forEach((m) => {
    const over = c.med ? ((m.unit - c.med) / c.med) * 100 : 0;
    if (over >= inflPct) rows.push({ part: m.part_name, make: c.make, supplier: m.supplier, quoted: m.unit, med: c.med, over: `+${over.toFixed(0)}%`, _cover: RED, _bg: "rgba(232,97,90,.10)" });
  }));
  return (<><Head>Every quoted line is compared with its cluster median; anything above the threshold is flagged for negotiation. This is the negotiation trigger the brief asks for. On the demo set most matched pairs are identical prices, so few flags appear — volume surfaces the real outliers.</Head>
    <div style={{ marginBottom: 14, fontSize: 12.5 }}>Flag threshold: <b style={{ color: RED }}>+{inflPct}%</b> over median&nbsp;&nbsp;
      <input type="range" min="5" max="100" step="5" value={inflPct} onChange={(e) => setInflPct(+e.target.value)} style={{ width: 220, verticalAlign: "middle" }} /></div>
    {rows.length ? <Tbl cols={[{k:"part",h:"Part"},{k:"make",h:"Make"},{k:"supplier",h:"Supplier"},{k:"quoted",h:"Quoted S$",a:"right"},{k:"med",h:"Median S$",a:"right",mut:1},{k:"over",h:"Over",a:"right",b:1}]} rows={rows} />
      : <Card><span style={{ color: MUTE, fontSize: 12.5 }}>No lines exceed +{inflPct}% over their cluster median at the current matching setting.</span></Card>}</>);
}
function MConfidence({ clusters }) {
  const now = new Date();
  const score = (c) => {
    const q = Math.min(1, (c.n - 1) / 4);                       // quote depth
    const s = Math.min(1, (c.suppliers.length - 1) / 3);        // supplier diversity
    const ds = c.dates.map(parseDate).filter(Boolean);
    const recency = ds.length ? Math.max(...ds.map((d) => 1 - Math.min(1, (now - d) / (1000*60*60*24*365*3)))) : 0;
    return Math.round((0.4*q + 0.35*s + 0.25*recency) * 100);
  };
  const rows = clusters.filter((c) => c.n > 1).map((c) => { const sc = score(c);
    return { label: c.label, make: c.make, n: c.n, sup: c.suppliers.length, score: sc,
      band: sc >= 60 ? "High" : sc >= 30 ? "Medium" : "Low", _cscore: sc >= 60 ? LIME : sc >= 30 ? AMBER : RED, _cband: sc >= 60 ? LIME : sc >= 30 ? AMBER : RED }; })
    .sort((a, b) => b.score - a.score);
  return (<><Head>Each benchmark is rated on quote depth, supplier diversity and recency (0–100). Insurers lean on high-confidence figures and treat thin ones as indicative. Weights: 40% depth, 35% diversity, 25% recency.</Head>
    {rows.length ? <Tbl cols={[{k:"label",h:"Benchmark part"},{k:"make",h:"Make"},{k:"n",h:"Quotes",a:"center"},{k:"sup",h:"Suppliers",a:"center"},{k:"score",h:"Score",a:"center",b:1},{k:"band",h:"Confidence",b:1}]} rows={rows} />
      : <Card><span style={{ color: MUTE, fontSize: 12.5 }}>No multi-quote clusters yet — confidence needs 2+ quotes.</span></Card>}</>);
}
function MDispersion({ clusters }) {
  const rows = clusters.filter((c) => c.n > 1 && c.spread > 0).map((c) => ({
    label: c.label, make: c.make, spread: c.spread, pctSpread: c.med ? `${((c.spread / c.med) * 100).toFixed(0)}%` : "—",
    detail: c.members.map((m) => `${m.supplier} S$${m.unit}`).join("  ·  "), _cpctSpread: RED,
  })).sort((a, b) => b.spread - a.spread);
  return (<><Head>Where the same part varies across suppliers, wide spread signals either genuine grade differences (OEM vs aftermarket) or a mispriced supplier — both worth knowing before negotiating.</Head>
    {rows.length ? <Tbl cols={[{k:"label",h:"Part"},{k:"make",h:"Make"},{k:"spread",h:"Spread S$",a:"right",b:1},{k:"pctSpread",h:"% of median",a:"right"},{k:"detail",h:"By supplier",mut:1}]} rows={rows} />
      : <Card><span style={{ color: MUTE, fontSize: 12.5 }}>No price dispersion within clusters at the current setting — matched quotes are identical.</span></Card>}</>);
}
function MTrend({ parts }) {
  const usable = parts.filter((p) => p.ltype === "Supplier Part" && parseDate(p.bill_date));
  const byCat = {};
  usable.forEach((p) => { (byCat[p.cat] = byCat[p.cat] || []).push(p); });
  const cats = Object.entries(byCat).filter(([, a]) => a.length >= 3).sort((a, b) => b[1].length - a[1].length).slice(0, 6);
  const allDates = usable.map((p) => parseDate(p.bill_date));
  const min = Math.min(...allDates), max = Math.max(...allDates), span = max - min || 1;
  return (<><Head>Unit price plotted by bill date, per category, to separate genuine drift from one-off spikes and to keep benchmarks current. Each dot is a part line; the lime marker is the category median.</Head>
    {cats.length ? cats.map(([cat, arr]) => {
      const units = arr.map((p) => p.unit); const umin = Math.min(...units), umax = Math.max(...units), urange = umax - umin || 1; const med = median(units);
      return (<div key={cat} style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 10, padding: "12px 16px", marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 8 }}>
          <b>{cat}</b><span style={{ color: MUTE }}>{arr.length} lines · S${umin}–{umax} · median S${med.toFixed(0)}</span></div>
        <div style={{ position: "relative", height: 40, background: "#082430", borderRadius: 6 }}>
          {arr.map((p, i) => { const x = ((parseDate(p.bill_date) - min) / span) * 96 + 2; const y = 90 - ((p.unit - umin) / urange) * 80;
            return <div key={i} title={`${p.part_name} S$${p.unit} ${p.bill_date}`} style={{ position: "absolute", left: `${x}%`, top: `${y}%`, width: 7, height: 7, borderRadius: 7, background: TEAL_L, transform: "translate(-50%,-50%)" }} />; })}
        </div></div>); })
      : <Card><span style={{ color: MUTE, fontSize: 12.5 }}>Not enough dated lines per category to plot a trend yet.</span></Card>}
    <p style={{ color: MUTE, fontSize: 11, marginTop: 4 }}>Time runs left→right across each strip; vertical position is unit price within the category.</p></>);
}
function MAgreement({ clusters }) {
  const rows = clusters.filter((c) => c.suppliers.length > 1).map((c) => {
    const withinTol = c.med ? (c.spread / c.med) <= 0.1 : false;
    return { label: c.label, make: c.make, suppliers: c.suppliers.join(", "), med: c.med, tol: `${c.med ? ((c.spread / c.med) * 100).toFixed(0) : 0}%`,
      verdict: withinTol ? "Agree (≤10%)" : "Diverge", _cverdict: withinTol ? LIME : AMBER, _bg: withinTol ? "rgba(195,215,0,.10)" : "transparent" };
  }).sort((a, b) => (a.verdict > b.verdict ? 1 : -1));
  return (<><Head>When the same part is quoted by independent suppliers at a similar price, that agreement is itself the credibility signal insurers and courts want. Clusters spanning 2+ suppliers within 10% are marked as agreeing.</Head>
    {rows.length ? <Tbl cols={[{k:"label",h:"Part"},{k:"make",h:"Make"},{k:"suppliers",h:"Independent suppliers",mut:1},{k:"med",h:"Median S$",a:"right",b:1},{k:"tol",h:"Spread",a:"right"},{k:"verdict",h:"Verdict",b:1}]} rows={rows} />
      : <Card><span style={{ color: MUTE, fontSize: 12.5 }}>No cross-supplier clusters yet — needs the same part from 2+ different suppliers.</span></Card>}</>);
}
function MAccuracy({ parts }) {
  // list vs net from estimate lines
  const est = parts.filter((p) => p.doc_type.toLowerCase().includes("estimate") && p.unit && p.total && p.unit !== p.total);
  const byBill = {};
  est.forEach((p) => { (byBill[p.bill_no] = byBill[p.bill_no] || []).push(p); });
  const summ = Object.entries(byBill).map(([bill, arr]) => {
    const list = arr.reduce((s, p) => s + p.unit, 0), net = arr.reduce((s, p) => s + p.total, 0);
    return { bill, supplier: arr[0].supplier, list: list.toFixed(0), net: net.toFixed(0), disc: `${(((list - net) / list) * 100).toFixed(0)}%`, _cdisc: AMBER };
  });
  // cross-source identical PN (all lines)
  const byPN = {}; parts.forEach((p) => { if (p.npn) (byPN[p.npn] = byPN[p.npn] || []).push(p); });
  const matches = Object.values(byPN).filter((a) => new Set(a.map((x) => x.bill_no)).size > 1);
  return (<><Head>To prove value (POC#2) you compare, per claim: supplier-bill cost vs repairer estimate line vs insurer final offer. The sample pairs these on different claims, so we show the two accuracy signals it does contain.</Head>
    <Card title="Signal 1 · List-vs-net margin inside repairer estimates" span="1 / -1">
      {summ.length ? <Tbl cols={[{k:"bill",h:"Estimate"},{k:"supplier",h:"Source"},{k:"list",h:"List S$",a:"right"},{k:"net",h:"Net S$",a:"right"},{k:"disc",h:"Discount",a:"right",b:1}]} rows={summ} />
        : <span style={{ color: MUTE, fontSize: 12.5 }}>No estimate lines with distinct list/net prices in this set.</span>}
      <p style={{ color: MUTE, fontSize: 11.5, marginTop: 8 }}>The list-to-net gap is the repairer margin the benchmark is meant to police.</p></Card>
    <div style={{ height: 14 }} />
    <Card title="Signal 2 · Cross-source identical part number" span="1 / -1">
      {matches.length ? matches.map((a, i) => (<div key={i} style={{ fontSize: 12.5, padding: "4px 0" }}>
        <b>{a[0].part_name}</b> · <span style={{ fontFamily: "ui-monospace,monospace" }}>{a[0].part_number}</span>: {a.map((x) => `${x.supplier} S$${x.unit}`).join("  vs  ")}
        {new Set(a.map((x) => x.unit)).size === 1 && <span style={{ color: LIME, fontWeight: 700 }}> — identical price (consistency)</span>}</div>))
        : <span style={{ color: MUTE, fontSize: 12.5 }}>No part number recurs across bills in this set.</span>}
      <p style={{ color: MUTE, fontSize: 11.5, marginTop: 8 }}>Full inflation quantification needs matched triples (bill + estimate + final offer) per claim — captured in Extraction #2.</p></Card></>);
}
function MNormalisation({ clusters }) {
  const multi = clusters.filter((c) => c.names.length > 1 || c.pns.length > 1).slice(0, 30);
  return (<><Head>None of the analytics work without collapsing the many ways a part is written into one entity. Below: fuzzy clusters that unified 2+ differently-written names or part numbers — the foundation the whole reference stands on.</Head>
    {multi.length ? <Tbl cols={[{k:"label",h:"Canonical"},{k:"make",h:"Make"},{k:"names",h:"Unified names",mut:1},{k:"pns",h:"Unified part nos",mono:1,mut:1}]}
      rows={multi.map((c) => ({ label: c.label, make: c.make, names: c.names.join("  |  "), pns: c.pns.join("  |  ") }))} />
      : <Card><span style={{ color: MUTE, fontSize: 12.5 }}>At the current threshold no cluster merged differing names. Loosen the threshold on the Benchmark tab to see merges.</span></Card>}</>);
}

function Coverage({ parts, clusters }) {
  const usable = parts.filter((p) => p.ltype === "Supplier Part");
  const catMap = {};
  usable.forEach((p) => { (catMap[p.cat] = catMap[p.cat] || { n: 0 }); catMap[p.cat].n++; });
  const cats = Object.entries(catMap).sort((a, b) => b[1].n - a[1].n);
  const covered = new Set(usable.map((p) => p.make));
  const hit = SG_MAKES.filter((m) => covered.has(m)).length;
  return (<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
    <Card title={`Make coverage · ${hit}/${SG_MAKES.length} common SG makes`}>
      {SG_MAKES.map((m) => { const n = usable.filter((p) => p.make === m).length;
        return <div key={m} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 12.5, color: n ? TEXT : MUTE }}>
          <span>{m}</span><span style={{ color: n ? LIME : MUTE }}>{n ? `${n} parts` : "— gap"}</span></div>; })}</Card>
    <Card title="Category coverage · usable parts">
      {cats.length ? cats.map(([c, v]) => <div key={c} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 12.5 }}>
        <span>{c}</span><span style={{ color: MUTE }}>{v.n} parts</span></div>) : <span style={{ color: MUTE, fontSize: 12.5 }}>No data yet.</span>}</Card>
    <div style={{ gridColumn: "1 / -1" }}><Card title="Success criteria (from the project brief)">
      <div style={{ fontSize: 12.5, lineHeight: 1.8 }}>
        <b style={{ color: LIME }}>a. Coverage completeness</b> — {hit} of {SG_MAKES.length} common makes and {cats.length} categories; {clusters.filter((c) => c.n > 1).length} fuzzy clusters have a 2+-quote benchmark. Depth grows with invoice volume.<br />
        <b style={{ color: LIME }}>b. Accuracy</b> — benchmark median vs repairer quote vs insurer final offer; see Analytics → Accuracy validation.</div></Card></div>
  </div>);
}
function MethodNotes() {
  const items = [
    ["Median benchmark", "Median unit price per fuzzy-matched cluster; average shown for skew. Median resists a single inflated bill."],
    ["Inflation flagging", "Each quoted line vs its cluster median; configurable % threshold flags outliers for negotiation."],
    ["Confidence scoring", "0–100 per benchmark from quote depth, supplier diversity and recency, so insurers know which figures to trust."],
    ["Supplier dispersion", "Spread of the same part across suppliers — flags grade differences or a mispriced supplier."],
    ["Price trend", "Unit price by bill date per category, separating genuine drift from one-off spikes."],
    ["Cross-source agreement", "Same part from independent suppliers within tolerance — the credibility signal for insurers and courts."],
    ["Accuracy validation", "List-vs-net margins in estimates + cross-source identical-PN matches; full inflation needs matched triples per claim."],
    ["Normalisation view", "The fuzzy clusters that unified differently-written names/part numbers — the foundation everything else stands on."],
  ];
  return (<div>
    <Head>Each method is live under the Analytics tab. These notes summarise what each computes and why it matters for an insurer-grade reference.</Head>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      {items.map(([t, d], i) => (<div key={i} style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 12, padding: 18 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "baseline", marginBottom: 8 }}>
          <span style={{ color: LIME, fontWeight: 800, fontSize: 12, fontFamily: "ui-monospace,monospace" }}>{String(i + 1).padStart(2, "0")}</span>
          <span style={{ fontWeight: 700, fontSize: 13.5, color: "#fff" }}>{t}</span></div>
        <div style={{ color: MUTE, fontSize: 12.5, lineHeight: 1.65 }}>{d}</div></div>))}</div>
    <div style={{ marginTop: 18, background: "#082430", border: `1px solid ${LINE}`, borderRadius: 12, padding: 20 }}>
      <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 8, color: LIME }}>Matching: fuzzy names, not exact part numbers</div>
      <div style={{ color: TEXT, fontSize: 12.5, lineHeight: 1.75 }}>Exact part numbers almost never repeat across a small bill set, so they yield no benchmarks. Fuzzy name matching (token overlap + edit distance, configurable on the Benchmark tab) clusters the same part written differently — e.g. "HEAD LAMP RH" with "HEADLAMP ASSY, RH" — which is what produces usable multi-quote medians. On a productised site, back this with SQLite: <span style={{ fontFamily: "ui-monospace,monospace", color: TEAL_L }}>suppliers</span>, <span style={{ fontFamily: "ui-monospace,monospace", color: TEAL_L }}>invoices</span>, <span style={{ fontFamily: "ui-monospace,monospace", color: TEAL_L }}>part_lines</span> tables plus a benchmark view; Postgres only for multi-tenant concurrency.</div></div>
  </div>);
}
