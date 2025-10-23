#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Миграция: добавление колонки added_at в таблицу playlists
"""

import sqlite3
import sys
from pathlib import Path

def migrate_database(db_path: str):
    """Добавляет колонку added_at если её нет"""
    try:
        print(f"🔧 Миграция базы данных: {db_path}")
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Проверяем существует ли колонка added_at
        cursor.execute("PRAGMA table_info(playlists)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if 'added_at' in columns:
            print("✅ Колонка added_at уже существует")
            conn.close()
            return True
        
        print("➕ Добавляем колонку added_at...")
        
        # SQLite не поддерживает DEFAULT CURRENT_TIMESTAMP в ALTER TABLE
        # Добавляем колонку без дефолтного значения
        cursor.execute('''
            ALTER TABLE playlists 
            ADD COLUMN added_at TIMESTAMP
        ''')
        
        # Для существующих записей устанавливаем added_at = parsed_at
        cursor.execute('''
            UPDATE playlists 
            SET added_at = COALESCE(parsed_at, CURRENT_TIMESTAMP)
            WHERE added_at IS NULL
        ''')
        
        conn.commit()
        
        # Проверяем результат
        cursor.execute("PRAGMA table_info(playlists)")
        columns_after = [row[1] for row in cursor.fetchall()]
        
        if 'added_at' in columns_after:
            print("✅ Колонка added_at успешно добавлена")
            
            # Показываем количество записей
            cursor.execute("SELECT COUNT(*) FROM playlists")
            count = cursor.fetchone()[0]
            print(f"📊 Обновлено записей: {count}")
        else:
            print("❌ Ошибка: колонка не была добавлена")
            conn.close()
            return False
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Ошибка миграции: {e}")
        return False

def main():
    """Главная функция"""
    print("="*60)
    print("🔄 МИГРАЦИЯ: Добавление added_at в playlists")
    print("="*60)
    
    # Пути к базам данных
    project_root = Path(__file__).parent.parent
    databases = [
        project_root / 'bandlink_playlists.db',
        project_root / 'bandlink_playlists_mac.db',
    ]
    
    success_count = 0
    for db_path in databases:
        if db_path.exists():
            print(f"\n📂 Обрабатываем: {db_path.name}")
            if migrate_database(str(db_path)):
                success_count += 1
        else:
            print(f"\n⚠️  База данных не найдена: {db_path.name}")
    
    print("\n" + "="*60)
    if success_count > 0:
        print(f"✅ Миграция завершена успешно ({success_count} БД)")
    else:
        print("❌ Миграция не выполнена")
    print("="*60)
    
    return success_count > 0

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)

