"""Тесты питон-обработчика отчётов.

Юнит-тестов у парсера не было вообще: он менялся вслепую, а проверялся только
глазами по результату прогона на проде. Здесь закреплено поведение, от которого
зависят деньги артистов — в первую очередь склейка связанных профилей (AKA) и
судьба строк, которых парсер не узнал.

Запуск: pnpm test:python
"""
import importlib.util
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
PROCESSOR = REPO / "lib" / "python-report-processor.py"


def load_processor():
    spec = importlib.util.spec_from_file_location("report_processor", PROCESSOR)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


prp = load_processor()


def write_users(users):
    handle = tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8")
    json.dump(users, handle, ensure_ascii=False)
    handle.close()
    return handle.name


def artist(uid, name, username, **extra):
    """Артист с полными реквизитами — парсер такого не отбраковывает."""
    row = {
        "id": uid,
        "role": "artist",
        "name": name,
        "username": username,
        "fio": f"Фамилия {name}",
        "contract": f"Д-{uid}",
        "percentage": 100,
    }
    row.update(extra)
    return row


GROUP_USERS = [
    artist("1", "Главный", "main"),
    artist("2", "Второе Имя", "aka2", mainArtistId="1"),
    artist("3", "Соло", "solo"),
    # Ссылка в никуда: главного нет в выгрузке.
    artist("4", "Битая Ссылка", "broken", mainArtistId="999"),
    # Неполный главный со своим привязанным профилем.
    {"id": "5", "role": "artist", "name": "Неполный", "username": "incomplete", "percentage": 50},
    artist("6", "Дитя Неполного", "child", mainArtistId="5"),
]


class TestArtistGrouping(unittest.TestCase):
    """Связанные профили сливаются в одного canonical-артиста."""

    @classmethod
    def setUpClass(cls):
        path = write_users(GROUP_USERS)
        cls.data, cls.match_list, cls.skipped, cls.alias2canon = prp.get_artists_list_from_users(path)
        os.unlink(path)
        cls.aliases = dict(cls.match_list)

    def test_linked_profile_is_not_a_separate_artist(self):
        self.assertNotIn("Второе Имя", self.data)
        self.assertIn("Главный", self.data)

    def test_group_names_become_aliases_of_the_main(self):
        self.assertEqual(
            set(self.aliases["Главный"]), {"Главный", "main", "Второе Имя", "aka2"}
        )

    def test_main_keeps_its_own_payment_details(self):
        fio, _fio_short, contract, percentage, uid = self.data["Главный"]
        self.assertEqual(fio, "Фамилия Главный")
        self.assertEqual(contract, "Д-1")
        self.assertEqual(percentage, "100")
        self.assertEqual(uid, "1")

    def test_dangling_link_falls_back_to_standalone(self):
        # Главный удалён — привязанный не должен исчезнуть из отчётов.
        self.assertIn("Битая Ссылка", self.data)

    def test_incomplete_main_takes_the_whole_group_down_but_keeps_aliases(self):
        skipped_names = [item["name"] for item in self.skipped]
        self.assertEqual(skipped_names.count("Неполный"), 1)
        self.assertNotIn("Дитя Неполного", skipped_names)
        # Псевдонимы остаются: иначе строки привязанного профиля утекли бы молча.
        self.assertEqual(
            set(self.aliases["Неполный"]),
            {"Неполный", "incomplete", "Дитя Неполного", "child"},
        )

    def test_alias_map_points_every_profile_at_its_canonical(self):
        self.assertEqual(self.alias2canon["Второе Имя"], "Главный")
        self.assertEqual(self.alias2canon["aka2"], "Главный")
        self.assertEqual(self.alias2canon["Соло"], "Соло")


class TestStatementMatching(unittest.TestCase):
    """Строка выписки, подписанная любым именем группы, ведёт на главного."""

    @classmethod
    def setUpClass(cls):
        path = write_users(GROUP_USERS)
        _data, cls.match_list, _skipped, _alias = prp.get_artists_list_from_users(path)
        os.unlink(path)

    def match(self, value):
        return prp.extract_artists_from_track(value, self.match_list)

    def test_linked_name_resolves_to_main(self):
        self.assertEqual(self.match("Второе Имя"), ["Главный"])
        self.assertEqual(self.match("aka2"), ["Главный"])

    def test_collab_of_linked_and_outsider_splits_correctly(self):
        self.assertEqual(set(self.match("Второе Имя feat. Соло")), {"Главный", "Соло"})

    def test_collab_within_one_group_counts_the_person_once(self):
        # «Главный & Второе Имя» — один человек под двумя именами.
        self.assertEqual(self.match("Главный & Второе Имя"), ["Главный"])

    def test_unknown_artist_matches_nothing(self):
        self.assertEqual(self.match("Кто-то Совсем Левый"), [])


class TestRoyaltyShareKeys(unittest.TestCase):
    """Доли роялти записаны именами — после склейки их надо перевести в canonical."""

    @classmethod
    def setUpClass(cls):
        path = write_users(GROUP_USERS)
        _d, _m, _s, cls.alias2canon = prp.get_artists_list_from_users(path)
        os.unlink(path)

    def test_share_under_linked_name_is_found_by_canonical(self):
        result = prp._normalize_share_keys({"ISRC1": {"Второе Имя": 0.4, "Соло": 0.6}}, self.alias2canon)
        self.assertEqual(result["ISRC1"], {"Главный": 0.4, "Соло": 0.6})

    def test_shares_of_one_group_are_summed(self):
        result = prp._normalize_share_keys(
            {"ISRC2": {"Главный": 0.3, "aka2": 0.2, "Соло": 0.5}}, self.alias2canon
        )
        self.assertAlmostEqual(result["ISRC2"]["Главный"], 0.5)

    def test_empty_alias_map_changes_nothing(self):
        original = {"ISRC3": {"Соло": 1.0}}
        self.assertEqual(prp._normalize_share_keys(original, {}), original)


class TestUnmatchedEmitter(unittest.TestCase):
    """Нераспознанные исполнители отдаются наверх, а не теряются."""

    def emit(self, unmatched):
        from io import StringIO
        from contextlib import redirect_stdout

        buffer = StringIO()
        with redirect_stdout(buffer):
            prp._emit_unmatched_json(unmatched)
        return buffer.getvalue()

    def test_reports_rows_and_money(self):
        output = self.emit({"Чужой": {"rows": 3, "totalAmount": 123.456}})
        payload = json.loads(output.split("UNMATCHED_JSON:", 1)[1])
        self.assertEqual(payload["unmatchedArtists"][0]["trackArtist"], "Чужой")
        self.assertEqual(payload["unmatchedArtists"][0]["rows"], 3)
        self.assertEqual(payload["unmatchedArtists"][0]["totalAmount"], 123.46)
        self.assertFalse(payload["unmatchedTruncated"])

    def test_sorted_by_money_and_truncated_with_a_flag(self):
        many = {f"Чужой {i}": {"rows": 1, "totalAmount": float(i)} for i in range(1, 260)}
        payload = json.loads(self.emit(many).split("UNMATCHED_JSON:", 1)[1])
        items = payload["unmatchedArtists"]
        self.assertEqual(len(items), prp.UNMATCHED_LIMIT)
        self.assertEqual(items[0]["trackArtist"], "Чужой 259")
        self.assertTrue(payload["unmatchedTruncated"])

    def test_silent_when_everything_matched(self):
        self.assertEqual(self.emit({}), "")


@unittest.skipUnless(
    importlib.util.find_spec("pandas") and importlib.util.find_spec("openpyxl"),
    "нужны pandas и openpyxl (pip install -r requirements-report-processor.txt)",
)
class TestProcessFileEndToEnd(unittest.TestCase):
    """Сквозной прогон: выписка XLSX → готовые отчёты и метаданные."""

    @classmethod
    def setUpClass(cls):
        from openpyxl import Workbook

        cls.tmp = Path(tempfile.mkdtemp(prefix="e2e-reports-"))

        wb = Workbook()
        ws = wb.active
        ws.title = "TDSheet"
        ws.append(["Код", "Исполнитель", "Наименование", "Альбом", "Количество", "Сумма, руб."])
        # Главный и его привязанный профиль — деньги должны слиться в один отчёт.
        ws.append(["ISRC-A", "Главный", "Трек А", "Альбом", 100, 1000.0])
        ws.append(["ISRC-B", "Второе Имя", "Трек Б", "Альбом", 50, 500.0])
        # Отдельный артист.
        ws.append(["ISRC-C", "Соло", "Трек В", "Альбом", 20, 200.0])
        # Никому не известное имя — деньги по нему не должны исчезнуть бесследно.
        ws.append(["ISRC-D", "Совсем Чужой", "Трек Г", "Альбом", 10, 77.0])
        statement = cls.tmp / "statement.xlsx"
        wb.save(statement)

        users_path = cls.tmp / "users.json"
        users_path.write_text(json.dumps(GROUP_USERS, ensure_ascii=False), encoding="utf-8")
        releases_path = cls.tmp / "releases.json"
        releases_path.write_text("[]", encoding="utf-8")

        cls.out_dir = cls.tmp / "out"
        cls.out_dir.mkdir()
        cls.metadata_path = cls.tmp / "metadata.json"

        result = subprocess.run(
            [
                sys.executable,
                str(PROCESSOR),
                str(statement),
                "Q1",
                "2026",
                str(users_path),
                str(releases_path),
                str(cls.out_dir),
                str(cls.metadata_path),
            ],
            capture_output=True,
            text=True,
            cwd=str(REPO),
        )
        cls.stdout = result.stdout
        cls.returncode = result.returncode
        if result.returncode != 0:
            print(result.stdout)
            print(result.stderr, file=sys.stderr)
        cls.metadata = (
            json.loads(cls.metadata_path.read_text(encoding="utf-8"))
            if cls.metadata_path.exists()
            else []
        )

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def by_artist(self):
        return {row["artistName"]: row for row in self.metadata}

    def test_run_succeeded(self):
        self.assertEqual(self.returncode, 0, "парсер завершился с ошибкой")

    def test_group_gets_exactly_one_merged_report(self):
        reports = self.by_artist()
        self.assertIn("Главный", reports)
        self.assertNotIn("Второе Имя", reports)
        # 1000 (Главный) + 500 (Второе Имя) слиты в один отчёт.
        self.assertAlmostEqual(reports["Главный"]["totalAmount"], 1500.0, places=2)
        self.assertEqual(reports["Главный"]["totalPlays"], 150)

    def test_report_is_written_on_the_main_profile_id(self):
        self.assertEqual(self.by_artist()["Главный"]["artistId"], "1")

    def test_independent_artist_keeps_a_separate_report(self):
        self.assertAlmostEqual(self.by_artist()["Соло"]["totalAmount"], 200.0, places=2)

    def test_unknown_artist_gets_no_report(self):
        self.assertNotIn("Совсем Чужой", self.by_artist())

    def test_unknown_artist_money_is_reported_not_swallowed(self):
        self.assertIn("UNMATCHED_JSON:", self.stdout)
        payload = json.loads(self.stdout.split("UNMATCHED_JSON:", 1)[1].splitlines()[0])
        names = {item["trackArtist"]: item for item in payload["unmatchedArtists"]}
        self.assertIn("Совсем Чужой", names)
        self.assertAlmostEqual(names["Совсем Чужой"]["totalAmount"], 77.0, places=2)

    def test_report_files_are_created(self):
        files = list(self.out_dir.glob("*.xlsx"))
        self.assertTrue(files, "не создано ни одного файла отчёта")


if __name__ == "__main__":
    unittest.main(verbosity=2)
