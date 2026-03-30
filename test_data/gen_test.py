import csv
import random
import os
import uuid
from datetime import datetime, timedelta

# Konfiguracja
NUM_FILES = 10
ROWS_PER_FILE = 60
OUTPUT_DIR = "orlen_plock_uat_reports"

# Branżowe moduły i systemy
systems = {
    "SAP_IS_Oil": ["Hurt_Paliw", "Wycena_Barylek", "Podatki_Akcyza", "Raportowanie_Zapasow"],
    "SCADA_Rafineria": ["Kolumna_Destylacyjna_C100", "Czujniki_Cisnienia", "Zawory_Biezace", "Alarmy_HSE"],
    "WMS_Petrochemia": ["Magazyn_Olejow", "Dystrybucja_Asfaltu", "Etykietowanie_Chemii", "Inwentaryzacja_Dronami"],
    "Fleet_TMS": ["GPS_Cysterny", "Czas_Pracy_Kierowcow", "Integracja_TollCollect", "Harmonogram_Zaladunku"],
    "Security_HQ": ["Bramki_Obrotowe", "Kamery_ANPR_Parking", "Karty_Dostepu_RFID", "Logi_Gosci"],
    "ERP_Korporacja": ["Kadry_Place", "Obieg_Faktur", "Zatwierdzanie_Budzetu", "Portal_Pracowniczy"],
    "IoT_Pipeline": ["Detekcja_Wyciekow", "Przeplywomierze", "Telemetria_Temperatury", "Zasilanie_Awaryjne"]
}

# Realistyczne błędy z podziałem na moduły i powagę
error_reasons = {
    "SCADA_Rafineria": [
        ("CRITICAL", "FAIL", "Brak odczytu z czujnika ciśnienia PT-405 (timeout > 500ms)"),
        ("HIGH", "FAIL", "Nieprawidłowy stan zaworu awaryjnego zrzutu gazu"),
        ("MEDIUM", "WARN", "Opóźnienie synchronizacji danych historycznych do hurtowni (1.2s)"),
    ],
    "SAP_IS_Oil": [
        ("CRITICAL", "FAIL", "Brak warunku cenowego dla ON Ekodiesel w hurcie"),
        ("HIGH", "FAIL", "Błąd wyliczenia podatku akcyzowego dla dokumentu WZ"),
        ("MEDIUM", "WARN", "Zbyt długa odpowiedź RFC z modułu MM (> 3000ms)"),
    ],
    "Fleet_TMS": [
        ("HIGH", "FAIL", "Błąd dekodowania pozycji GPS z cysterny (null format)"),
        ("LOW", "WARN", "Kierowca przekroczył limit pauzy wg API tacho, ale brak alertu na froncie"),
    ],
    "Security_HQ": [
        ("CRITICAL", "FAIL", "Bramka główna (Północ) nie blokuje dostępu przy unieważnionej karcie RFID"),
        ("HIGH", "FAIL", "System kamer ANPR nie rozpoznaje zabrudzonych tablic rejestracyjnych"),
        ("LOW", "WARN", "Brak zdjęcia gościa w logach wejść"),
    ],
    "IoT_Pipeline": [
        ("CRITICAL", "FAIL", "Algorytm detekcji wycieków zwrócił False Negative podczas testu wstrzykiwania"),
        ("HIGH", "FAIL", "Brak fallbacku na zasilanie awaryjne w węźle komunikacyjnym 12"),
    ],
    "GENERIC": [
        ("HIGH", "FAIL", "HTTP 500 Internal Server Error podczas strzału do API API Gateway"),
        ("MEDIUM", "FAIL", "Niezgodność schematu JSON z dokumentacją Swagger"),
        ("LOW", "WARN", "Użyto zdeprecjonowanego endpointu v2.1 (zalecany v3.0)"),
    ]
}

pass_messages = ["OK", "Test zaliczony", "Dane zapisane poprawnie", "Zgodnie z asercją", "Sygnał odebrany"]

os.makedirs(OUTPUT_DIR, exist_ok=True)
base_time = datetime.now() - timedelta(days=2)

for i in range(1, NUM_FILES + 1):
    filename = os.path.join(OUTPUT_DIR, f"Test_Report_Plock_Modul_{i}.csv")
    
    with open(filename, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f, delimiter=';')
        writer.writerow(["Test_ID", "System", "Komponent", "Priorytet_Biznesowy", "Status", "Czas_ms", "Opis_Bledu"])
        
        for j in range(1, ROWS_PER_FILE + 1):
            sys_name = random.choice(list(systems.keys()))
            component = random.choice(systems[sys_name])
            
            # Wagi: 80% PASS, 15% FAIL, 5% WARN
            outcome = random.choices(["PASS", "FAIL", "WARN"], weights=[80, 15, 5], k=1)[0]
            
            if outcome == "PASS":
                priority = random.choice(["CRITICAL", "HIGH", "MEDIUM", "LOW"])
                reason = random.choice(pass_messages)
            else:
                # Jeśli błąd, bierzemy kontekstowy błąd dla danego systemu lub generyczny
                if sys_name in error_reasons and random.random() > 0.3:
                    error_pool = error_reasons[sys_name]
                else:
                    error_pool = error_reasons["GENERIC"]
                
                # Odfiltrowanie pasujących do outcome (żeby FAIL nie brał opisów WARN)
                valid_errors = [e for e in error_pool if e[1] == outcome]
                if not valid_errors:
                    valid_errors = [("MEDIUM", outcome, f"Nieokreślony błąd integracji w {component}")]
                
                chosen_error = random.choice(valid_errors)
                priority = chosen_error[0]
                reason = chosen_error[2]
            
            time_ms = random.randint(10, 800) if outcome == "PASS" else random.randint(1000, 15000)
            test_id = f"UAT-{sys_name[:3]}-{uuid.uuid4().hex[:6].upper()}"
            
            # Ciekawostka: Wymuszenie twardego, krytycznego błędu bezpieczeństwa w co 5. pliku
            if outcome == "PASS" and i % 5 == 0 and j == ROWS_PER_FILE:
                outcome = "FAIL"
                priority = "CRITICAL"
                sys_name = "Security_HQ"
                component = "Kamery_ANPR_Parking"
                reason = "KRYTYCZNE: System przepuścił cysternę bez autoryzacji na terminal załadunkowy!"
            
            writer.writerow([test_id, sys_name, component, priority, outcome, time_ms, reason])

print(f" Wygenerowano {NUM_FILES} zaawansowanych plików CSV dla Płocka w folderze '{OUTPUT_DIR}'.")