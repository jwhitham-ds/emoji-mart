import i18n_en from '@emoji-mart/data/i18n/en.json'
import PickerProps from './components/Picker/PickerProps'
import {
  FrequentlyUsed,
  NativeSupport,
  SafeFlags,
  SearchIndex,
} from './helpers'

export interface Data {
  categories: Category[];
  emojis: { [key: string]: Emoji };
  aliases: { [key: string]: string };
  sheet: { cols: number, rows: number };
  emoticons?: { [emoticon: string]: string };
  natives?: { [native: string]: string };
}

export interface Category {
  icon?: string;
  id: string;
  name?: string;
  emojis: string[];
}

export interface Emoji {
  aliases: string[];
  emoticons?: string[];
  id: string;
  keywords?: string[];
  name: string;
  search?: string;
  skins: SkinVariation[];
  version: number;
}

export interface SkinVariation {
  shortcodes?: string;
  unified: string;
  native: string;
  x: number;
  y: number;
}

export type CategoryName =
  | 'activity'
  | 'custom'
  | 'flags'
  | 'foods'
  | 'frequent'
  | 'nature'
  | 'objects'
  | 'people'
  | 'places'
  | 'search'
  | 'symbols'

export type SkinChoice =
  | 'choose'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'

export interface I18n {
  add_custom: string;
  categories: Record<CategoryName, string>;
  pick: string;
  rtl?: boolean;
  search: string;
  search_no_results_1: string;
  search_no_results_2: string;
  skins: Record<SkinChoice, string>;
}

export let i18n: I18n;
export let data: Data;

async function fetchJSON(src: string) {
  const response = await fetch(src)
  return await response.json()
}

let promise: Promise<void>
let initCallback: (value: void | PromiseLike<void>) => void

export function init(options) {
  promise ||
    (promise = new Promise((resolve) => {
      initCallback = resolve
    }))

  if (options) {
    _init(options)
  }

  return promise
}

async function _init(props) {
  let { emojiVersion, set, locale } = props
  emojiVersion || (emojiVersion = PickerProps.emojiVersion.value)
  set || (set = PickerProps.set.value)
  locale || (locale = PickerProps.locale.value)

  if (!data) {
    data =
      (typeof props.data === 'function' ? await props.data() : props.data) ||
      (await fetchJSON(
        `https://cdn.jsdelivr.net/npm/@emoji-mart/data@latest/sets/${emojiVersion}/${set}.json`,
      ))

    data.emoticons = {}
    data.natives = {}

    data.categories.unshift({
      id: 'frequent',
      emojis: [],
    })

    for (const alias in data.aliases) {
      const emojiId = data.aliases[alias]
      const emoji = data.emojis[emojiId]
      if (!emoji) continue

      emoji.aliases || (emoji.aliases = [])
      emoji.aliases.push(alias)
    }
  } else {
    data.categories = data.categories.filter((c) => {
      const isCustom = !!c.name
      if (!isCustom) return true

      return false
    })
  }

  if (!i18n) {
    i18n =
      (typeof props.i18n === 'function' ? await props.i18n() : props.i18n) ||
      (locale == 'en'
        ? i18n_en
        : await fetchJSON(
            `https://cdn.jsdelivr.net/npm/@emoji-mart/data@latest/i18n/${locale}.json`,
          ))
  }

  if (props.custom) {
    for (let x in props.custom) {
      const i = parseInt(x)
      const category = props.custom[i]
      const prevCategory = props.custom[i - 1]

      if (!category.emojis || !category.emojis.length) continue

      category.id || (category.id = `custom_${i + 1}`)
      category.name || (category.name = i18n.categories.custom)

      if (prevCategory && !category.icon) {
        category.target = prevCategory.target || prevCategory
      }

      data.categories.push(category)

      const ids = []
      for (const emoji of category.emojis) {
        if (ids.indexOf(emoji.id) > -1) {
          continue
        }

        data.emojis[emoji.id] = emoji
        ids.push(emoji.id)
      }

      category.emojis = ids
    }
  }

  if (props.categories) {
    data.categories = data.categories
      .filter((c) => {
        return props.categories.indexOf(c.id) != -1
      })
      .sort((c1, c2) => {
        const i1 = props.categories.indexOf(c1.id)
        const i2 = props.categories.indexOf(c2.id)

        return i1 - i2
      })
  }

  let latestVersionSupport = null
  let noCountryFlags = null
  if (set == 'native') {
    latestVersionSupport = NativeSupport.latestVersion()
    noCountryFlags = props.noCountryFlags || NativeSupport.noCountryFlags()
  }

  let categoryIndex = data.categories.length
  let resetSearchIndex = false
  while (categoryIndex--) {
    const category = data.categories[categoryIndex]

    if (category.id == 'frequent') {
      category.emojis = FrequentlyUsed.get(props)
    }

    if (!category.emojis || !category.emojis.length) {
      data.categories.splice(categoryIndex, 1)
      continue
    }

    const { categoryIcons } = props
    if (categoryIcons) {
      const icon = categoryIcons[category.id]
      if (icon && !category.icon) {
        category.icon = icon
      }
    }

    let emojiIndex = category.emojis.length
    while (emojiIndex--) {
      const emoji = data.emojis[category.emojis[emojiIndex]]
      const ignore = () => {
        category.emojis.splice(emojiIndex, 1)
      }

      if (!emoji) {
        ignore()
        continue
      }

      if (latestVersionSupport && emoji.version > latestVersionSupport) {
        ignore()
        continue
      }

      if (noCountryFlags && category.id == 'flags') {
        if (!SafeFlags.includes(emoji.id)) {
          ignore()
          continue
        }
      }

      if (!emoji.search) {
        resetSearchIndex = true
        emoji.search =
          ',' +
          [
            [emoji.id, false],
            [emoji.name, true],
            [emoji.keywords, false],
            [emoji.emoticons, false],
          ]
            .map(([strings, split]) => {
              if (!strings) return
              return (Array.isArray(strings) ? strings : [strings])
                .map((string) => {
                  return (split ? string.split(/[-|_|\s]+/) : [string]).map(
                    (s) => s.toLowerCase(),
                  )
                })
                .flat()
            })
            .flat()
            .filter((a) => a && a.trim())
            .join(',')

        if (emoji.emoticons) {
          for (const emoticon of emoji.emoticons) {
            if (data.emoticons) {
              if (data.emoticons[emoticon]) continue
              data.emoticons[emoticon] = emoji.id
            }
          }
        }

        let skinIndex = 0
        for (const skin of emoji.skins) {
          if (!skin) continue
          skinIndex++

          const { native } = skin
          if (native && data.natives) {
            data.natives[native] = emoji.id
            emoji.search += `,${native}`
          }

          const skinShortcodes =
            skinIndex == 1 ? '' : `:skin-tone-${skinIndex}:`
          skin.shortcodes = `:${emoji.id}:${skinShortcodes}`
        }
      }
    }
  }

  if (resetSearchIndex) {
    SearchIndex.reset()
  }

  if (initCallback) initCallback()
}

export function getProps(props, defaultProps, element) {
  props || (props = {})

  const _props = {}
  for (let k in defaultProps) {
    _props[k] = getProp(k, props, defaultProps, element)
  }

  return _props
}

export function getProp(propName, props, defaultProps, element) {
  const defaults = defaultProps[propName]
  let value =
    (element && element.getAttribute(propName)) ||
    (props[propName] != null && props[propName] != undefined
      ? props[propName]
      : null)

  if (!defaults) {
    return value
  }

  if (
    value != null &&
    defaults.value &&
    typeof defaults.value != typeof value
  ) {
    if (typeof defaults.value == 'boolean') {
      value = value == 'false' ? false : true
    } else {
      value = defaults.value.constructor(value)
    }
  }

  if (
    value == null ||
    (defaults.choices && defaults.choices.indexOf(value) == -1)
  ) {
    value = defaults.value
  }

  return value
}
