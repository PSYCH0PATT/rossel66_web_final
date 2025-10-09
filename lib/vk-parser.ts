import * as cheerio from "cheerio"

export interface ParsedPlaylist {
  name: string
  imageUrl: string
  playlistUrl: string
}

export function parseVkMusicArtistPage(html: string): ParsedPlaylist[] {
  const $ = cheerio.load(html)
  const playlists: ParsedPlaylist[] = []

  // Основной селектор для плейлистов - ui_gallery_item
  $(".ui_gallery_item").each((_, element) => {
    try {
      // Получаем название плейлиста
      const name =
        $(element).find(".audio_pl__title").text().trim() ||
        $(element).find(".audio_row__title_inner").text().trim() ||
        $(element).find(".audio_pl_item__title").text().trim()

      // Получаем URL изображения
      const imgElement = $(element).find("img")
      let imageUrl = imgElement.attr("src") || imgElement.attr("data-src") || ""

      // Получаем ссылку на плейлист
      let playlistUrl = $(element).find("a").attr("href") || ""

      // Проверка и формирование полных URL
      if (imageUrl && !imageUrl.startsWith("http")) {
        imageUrl = imageUrl.startsWith("//") ? `https:${imageUrl}` : `https://${imageUrl}`
      }

      if (playlistUrl && !playlistUrl.startsWith("http")) {
        playlistUrl = `https://vk.com${playlistUrl}`
      }

      if (name && imageUrl && playlistUrl) {
        playlists.push({
          name,
          imageUrl,
          playlistUrl,
        })
      }
    } catch (error) {
      console.error("Error parsing gallery item:", error)
    }
  })

  // Альтернативный селектор для плейлистов
  if (playlists.length === 0) {
    $('[class*="audio_pl_item"]').each((_, element) => {
      try {
        // Получаем название плейлиста
        const nameElement = $(element).find(".audio_pl_item__title") || $(element).find(".audio_pl__title")
        const name = nameElement.text().trim()

        // Получаем URL изображения
        const imgElement = $(element).find("img")
        let imageUrl = imgElement.attr("src") || imgElement.attr("data-src") || ""

        // Получаем ссылку на плейлист
        let playlistUrl = ""
        const parent = $(element).closest("a")
        if (parent.length > 0) {
          playlistUrl = parent.attr("href") || ""
        }

        // Если не нашли в родительском, попробуем найти любую ссылку внутри элемента
        if (!playlistUrl) {
          const linkElement = $(element).find('a[href*="/music/playlist/"]')
          playlistUrl = linkElement.attr("href") || ""
        }

        // Проверка и формирование полных URL
        if (imageUrl && !imageUrl.startsWith("http")) {
          imageUrl = imageUrl.startsWith("//") ? `https:${imageUrl}` : `https://${imageUrl}`
        }

        if (playlistUrl && !playlistUrl.startsWith("http")) {
          playlistUrl = `https://vk.com${playlistUrl}`
        }

        if (name && imageUrl && playlistUrl) {
          playlists.push({
            name,
            imageUrl,
            playlistUrl,
          })
        }
      } catch (error) {
        console.error("Error parsing playlist element:", error)
      }
    })
  }

  // Третий селектор - для блоков "Встречается в плейлистах"
  if (playlists.length === 0) {
    $(".audio_block_small_item").each((_, element) => {
      try {
        // Получаем название плейлиста
        const name = $(element).find(".audio_block_small_item_title").text().trim()

        // Получаем URL изображения
        const imgElement = $(element).find("img")
        let imageUrl = imgElement.attr("src") || imgElement.attr("data-src") || ""

        // Получаем ссылку на плейлист
        let playlistUrl = $(element).find("a").attr("href") || ""

        // Проверка и формирование полных URL
        if (imageUrl && !imageUrl.startsWith("http")) {
          imageUrl = imageUrl.startsWith("//") ? `https:${imageUrl}` : `https://${imageUrl}`
        }

        if (playlistUrl && !playlistUrl.startsWith("http")) {
          playlistUrl = `https://vk.com${playlistUrl}`
        }

        if (name && imageUrl && playlistUrl) {
          playlists.push({
            name,
            imageUrl,
            playlistUrl,
          })
        }
      } catch (error) {
        console.error("Error parsing audio block item:", error)
      }
    })
  }

  // Четвертый селектор - для секции "Встречается в плейлистах" на странице артиста
  if (playlists.length === 0) {
    $(".audio_row__info").each((_, element) => {
      try {
        // Получаем название плейлиста
        const name = $(element).find(".audio_row__title_inner").text().trim()

        // Получаем платформу (VK Музыка)
        const platform = $(element).find(".audio_row__subtitle").text().trim()

        if (platform.includes("VK") || platform.includes("ВК")) {
          // Получаем URL изображения из родительского элемента
          const parent = $(element).closest(".audio_row")
          const imgElement = parent.find("img")
          let imageUrl = imgElement.attr("src") || imgElement.attr("data-src") || ""

          // Получаем ссылку на плейлист
          let playlistUrl = parent.find("a").attr("href") || ""

          // Проверка и формирование полных URL
          if (imageUrl && !imageUrl.startsWith("http")) {
            imageUrl = imageUrl.startsWith("//") ? `https:${imageUrl}` : `https://${imageUrl}`
          }

          if (playlistUrl && !playlistUrl.startsWith("http")) {
            playlistUrl = `https://vk.com${playlistUrl}`
          }

          if (name && imageUrl && playlistUrl) {
            playlists.push({
              name,
              imageUrl,
              playlistUrl,
            })
          }
        }
      } catch (error) {
        console.error("Error parsing audio row info:", error)
      }
    })
  }

  // Если на странице есть текст "Встречается в плейлистах", попробуем найти плейлисты по структуре
  if (playlists.length === 0 && html.includes("Встречается в плейлистах")) {
    // Ищем все блоки с изображениями и текстом, которые могут быть плейлистами
    $("a").each((_, element) => {
      const href = $(element).attr("href") || ""
      if (href.includes("/music/playlist/")) {
        try {
          // Получаем название плейлиста - ищем любой текстовый элемент внутри
          const name = $(element).text().trim()

          // Получаем URL изображения
          const imgElement = $(element).find("img")
          let imageUrl = imgElement.attr("src") || imgElement.attr("data-src") || ""

          // Формируем URL плейлиста
          let playlistUrl = href

          // Проверка и формирование полных URL
          if (imageUrl && !imageUrl.startsWith("http")) {
            imageUrl = imageUrl.startsWith("//") ? `https:${imageUrl}` : `https://${imageUrl}`
          }

          if (playlistUrl && !playlistUrl.startsWith("http")) {
            playlistUrl = `https://vk.com${playlistUrl}`
          }

          if (name && imageUrl && playlistUrl) {
            playlists.push({
              name,
              imageUrl,
              playlistUrl,
            })
          }
        } catch (error) {
          console.error("Error parsing playlist link:", error)
        }
      }
    })
  }

  // Удаляем дубликаты по URL
  const uniquePlaylists = playlists.filter(
    (playlist, index, self) => index === self.findIndex((p) => p.playlistUrl === playlist.playlistUrl),
  )

  return uniquePlaylists
}

// Функция для добавления плейлистов артисту
export async function addPlaylistsToArtist(artistId: string, playlists: ParsedPlaylist[]): Promise<void> {
  // Получаем плейлисты из localStorage (если есть)
  try {
    const playlistsStr = localStorage.getItem("playlists")
    const existingPlaylists = playlistsStr ? JSON.parse(playlistsStr) : []

    // Удаляем старые плейлисты этого артиста из VK Music
    const filteredPlaylists = existingPlaylists.filter(
      (p: any) =>
        !(p.artistId === artistId && p.platform === "VK Музыка" && p.externalUrl && p.externalUrl.includes("vk.com")),
    )

    const newPlaylists = playlists.map((playlist, index) => ({
      id: `pl_vk_${Date.now()}_${index}`,
      name: playlist.name,
      platform: "VK Музыка",
      imageUrl: playlist.imageUrl,
      trackId: "", // Пустой trackId
      artistId,
      addedDate: new Date().toISOString().split("T")[0],
      description: "Плейлист из ВК Музыки",
      externalUrl: playlist.playlistUrl,
    }))

    const updatedPlaylists = [...filteredPlaylists, ...newPlaylists]
    localStorage.setItem("playlists", JSON.stringify(updatedPlaylists))
  } catch (error) {
    console.error("Error adding playlists to artist:", error)
    throw error
  }
}
