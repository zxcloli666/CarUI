#!/bin/bash

# Пути (относительно корня carui-frontend)
SOURCE_DIR="../audio"
ANDROID_RAW_DIR="android/app/src/main/res/raw"
ANDROID_ASSETS_DIR="android/app/src/main/assets/audio"

echo "=============================================="
echo "🔊 CarUI Audio Sync"
echo "From: $SOURCE_DIR"
echo "To:   $ANDROID_RAW_DIR (Audio)"
echo "      $ANDROID_ASSETS_DIR (Avatars)"
echo "=============================================="

# Проверка ffmpeg
if ! command -v ffmpeg &> /dev/null; then
    echo "❌ Ошибка: ffmpeg не установлен. Установите его (sudo pacman -S ffmpeg / apt install ffmpeg)"
    exit 1
fi

# Усиление: текущая средняя громкость ~ -26.4 dB, x2 -> +6 dB (цель ~ -20.4 dB)
BOOST_DB=15.0

# 1. Очистка целевых папок
echo "🧹 Очистка старых файлов..."
rm -f "$ANDROID_RAW_DIR"/*.ogg
rm -f "$ANDROID_RAW_DIR"/*.mp3
# Не удаляем всю папку assets, там могут быть другие ассеты, чистим только аудио
rm -rf "$ANDROID_ASSETS_DIR"

# Создаем структуру если нет
mkdir -p "$ANDROID_RAW_DIR"
mkdir -p "$ANDROID_ASSETS_DIR"

# 2. Обработка паков
echo "🔄 Начало обработки паков..."

# Проходим по всем папкам в ../audio
find "$SOURCE_DIR" -mindepth 1 -maxdepth 1 -type d | while read -r pack_path; do
    pack_name=$(basename "$pack_path" | tr '[:upper:]' '[:lower:]') # Имя пака в lowercase

    echo "📦 Обработка пака: [$pack_name]"

    # --- ЧАСТЬ 1: АВАТАРКИ (в assets) ---
    mkdir -p "$ANDROID_ASSETS_DIR/$pack_name"
    if [ -f "$pack_path/avatar.jpg" ]; then
        cp "$pack_path/avatar.jpg" "$ANDROID_ASSETS_DIR/$pack_name/avatar.jpg"
        echo "   🖼️  Avatar скопирован"
    fi

    # --- ЧАСТЬ 2: АУДИО (в res/raw плоским списком) ---
    # Ищем аудиофайлы (mp3, wav, ogg, m4a)
    # shellcheck disable=SC2095
    find "$pack_path" -type f \( -name "*.mp3" -o -name "*.wav" -o -name "*.ogg" -o -name "*.m4a" \) | while read -r file; do
        filename=$(basename "$file")
        filename_no_ext="${filename%.*}"

        # Формируем имя ресурса: pack_code.ogg (только a-z, 0-9, _)
        # sed заменяет дефисы на подчеркивания и убирает спецсимволы
        clean_name=$(echo "$filename_no_ext" | tr '[:upper:]' '[:lower:]' | sed 's/-/_/g' | sed 's/[^a-z0-9_]//g')
        target_name="${pack_name}_${clean_name}.ogg"
        target_path="$ANDROID_RAW_DIR/$target_name"

        # Конвертация через ffmpeg с усилением громкости
        # -vn (без видео), -acodec libvorbis (ogg), -aq 4 (качество ~128kbps), -y (перезаписать), loglevel error (тихо)
        ffmpeg -i "$file" -vn -acodec libvorbis -aq 4 -af "volume=${BOOST_DB}dB" -y "$target_path" -loglevel error
        echo "   🎵 Convert: $filename -> $target_name (+${BOOST_DB}dB)"
    done
done

echo "=============================================="
echo "✅ Готово! Не забудь пересобрать приложение:"
echo "   cd android && ./gradlew clean"
echo "   npx react-native run-android"
echo "=============================================="
