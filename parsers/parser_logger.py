"""
Parser logging helper for sending detailed logs to the activity system
"""
import requests
import json
from typing import Optional, Dict, Any
from pathlib import Path
import os

# Get the API base URL from environment or use default
API_BASE_URL = os.getenv('API_BASE_URL', 'http://localhost:3000')

def log_parser_event(
    event_type: str,
    title: str,
    description: str,
    metadata: Optional[Dict[str, Any]] = None,
    user_id: str = 'system',
    user_role: str = 'admin'
) -> bool:
    """
    Log a parser event to the activity system
    
    Args:
        event_type: Type of event (parser_started, parser_completed, parser_error, etc.)
        title: Short title for the event
        description: Detailed description
        metadata: Additional metadata (release info, playlist info, etc.)
        user_id: User ID (default: 'system')
        user_role: User role (default: 'admin')
    
    Returns:
        bool: True if logged successfully, False otherwise
    """
    try:
        url = f"{API_BASE_URL}/api/activities/parser-log"
        
        payload = {
            'type': event_type,
            'title': title,
            'description': description,
            'metadata': metadata or {},
            'userId': user_id,
            'userRole': user_role
        }
        
        response = requests.post(url, json=payload, timeout=5)
        
        if response.status_code == 200:
            print(f"✅ Logged: {title}")
            return True
        else:
            print(f"⚠️ Failed to log activity: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error logging parser event: {e}")
        return False

def log_parser_start(parser_name: str, metadata: Optional[Dict[str, Any]] = None):
    """Log parser start event"""
    return log_parser_event(
        event_type='parser_started',
        title=f'Парсер {parser_name} запущен',
        description=f'Начало работы парсера {parser_name}',
        metadata=metadata or {'parser': parser_name}
    )

def log_parser_complete(parser_name: str, stats: Dict[str, Any]):
    """Log parser completion event"""
    return log_parser_event(
        event_type='parser_completed',
        title=f'Парсер {parser_name} завершён',
        description=f'Парсер {parser_name} успешно завершил работу. Статистика: {json.dumps(stats, ensure_ascii=False)}',
        metadata={'parser': parser_name, 'stats': stats}
    )

def log_parser_error(parser_name: str, error_message: str, metadata: Optional[Dict[str, Any]] = None):
    """Log parser error event"""
    return log_parser_event(
        event_type='parser_error',
        title=f'Ошибка парсера {parser_name}',
        description=f'Парсер {parser_name} завершился с ошибкой: {error_message}',
        metadata={'parser': parser_name, 'error': error_message, **(metadata or {})}
    )

def log_release_found(
    parser_name: str,
    release_title: str,
    artist_name: str,
    upc: Optional[str] = None,
    release_url: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
):
    """Log when a release is found by parser"""
    return log_parser_event(
        event_type='parser_release_found',
        title=f'Найден релиз: {release_title}',
        description=f'Парсер {parser_name} нашёл релиз "{release_title}" артиста {artist_name}',
        metadata={
            'parser': parser_name,
            'releaseTitle': release_title,
            'artistName': artist_name,
            'upc': upc,
            'releaseUrl': release_url,
            **(metadata or {})
        }
    )

def log_release_updated(
    parser_name: str,
    release_title: str,
    artist_name: str,
    changes: Dict[str, Any],
    metadata: Optional[Dict[str, Any]] = None
):
    """Log when a release is updated by parser"""
    changes_str = ', '.join([f"{k}: {v}" for k, v in changes.items()])
    return log_parser_event(
        event_type='parser_release_updated',
        title=f'Обновлён релиз: {release_title}',
        description=f'Парсер {parser_name} обновил релиз "{release_title}" артиста {artist_name}. Изменения: {changes_str}',
        metadata={
            'parser': parser_name,
            'releaseTitle': release_title,
            'artistName': artist_name,
            'changes': changes,
            **(metadata or {})
        }
    )

def log_playlist_found(
    parser_name: str,
    playlist_name: str,
    playlist_url: str,
    platform: str,
    artist_name: str,
    track_count: int = 0,
    metadata: Optional[Dict[str, Any]] = None
):
    """Log when a playlist is found by parser"""
    return log_parser_event(
        event_type='parser_playlist_found',
        title=f'Найден плейлист: {playlist_name}',
        description=f'Парсер {parser_name} нашёл плейлист "{playlist_name}" на платформе {platform} для артиста {artist_name} ({track_count} треков)',
        metadata={
            'parser': parser_name,
            'playlistName': playlist_name,
            'playlistUrl': playlist_url,
            'platform': platform,
            'artistName': artist_name,
            'trackCount': track_count,
            **(metadata or {})
        }
    )
