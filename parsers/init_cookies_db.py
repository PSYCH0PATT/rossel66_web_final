#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Инициализация базы данных для хранения cookies и статуса парсера
"""

import sqlite3
import os
import sys

def init_database():
    """Создание таблиц для cookies и статуса парсера"""
    
    # Путь к БД
    db_path = os.path.join(os.path.dirname(__file__), '..', 'bandlink_playlists.db')
    
    print(f"📦 Инициализация БД: {db_path}")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Таблица для cookies
        print("📝 Создание таблицы bandlink_cookies...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS bandlink_cookies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cookie_name TEXT NOT NULL,
                cookie_value TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Таблица для статуса парсера
        print("📝 Создание таблицы parser_status...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS parser_status (
                id INTEGER PRIMARY KEY,
                status TEXT,
                last_run TIMESTAMP,
                needs_new_cookies INTEGER DEFAULT 0,
                failed_attempts INTEGER DEFAULT 0
            )
        """)
        
        # Вставляем начальную запись статуса
        cursor.execute("""
            INSERT OR IGNORE INTO parser_status (id, status, needs_new_cookies, failed_attempts)
            VALUES (1, 'initialized', 0, 0)
        """)
        
        # Таблица для плейлистов (если не существует)
        print("📝 Создание таблицы bandlink_playlists...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS bandlink_playlists (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                artist_name TEXT NOT NULL,
                platform TEXT NOT NULL,
                playlist_url TEXT NOT NULL UNIQUE,
                parsed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        conn.commit()
        conn.close()
        
        print("✅ База данных успешно инициализирована!")
        print("\n📋 Созданные таблицы:")
        print("  - bandlink_cookies (хранение cookies)")
        print("  - parser_status (статус парсера)")
        print("  - bandlink_playlists (найденные плейлисты)")
        
        return True
        
    except sqlite3.Error as e:
        print(f"❌ Ошибка инициализации БД: {e}")
        return False


def show_status():
    """Показать текущий статус БД"""
    db_path = os.path.join(os.path.dirname(__file__), '..', 'bandlink_playlists.db')
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Проверяем cookies
        cursor.execute("SELECT COUNT(*) FROM bandlink_cookies")
        cookies_count = cursor.fetchone()[0]
        
        # Проверяем статус
        cursor.execute("SELECT status, last_run, needs_new_cookies, failed_attempts FROM parser_status WHERE id = 1")
        status_row = cursor.fetchone()
        
        # Проверяем плейлисты
        cursor.execute("SELECT COUNT(*) FROM bandlink_playlists")
        playlists_count = cursor.fetchone()[0]
        
        conn.close()
        
        print("\n📊 Статус базы данных:")
        print(f"  🍪 Cookies: {cookies_count}")
        print(f"  🎵 Плейлисты: {playlists_count}")
        
        if status_row:
            status, last_run, needs_cookies, failed = status_row
            print(f"  📈 Статус парсера: {status}")
            print(f"  ⏰ Последний запуск: {last_run or 'Никогда'}")
            print(f"  ⚠️  Нужны новые cookies: {'Да' if needs_cookies else 'Нет'}")
            print(f"  ❌ Неудачных попыток: {failed}")
        
    except sqlite3.Error as e:
        print(f"❌ Ошибка чтения БД: {e}")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--status":
        show_status()
    else:
        if init_database():
            show_status()

