import {
  type AppLocale,
  INTL_LOCALE,
  isAppLocale,
} from "@workspace/i18n/locales";
import { getLocale } from "@/paraglide/runtime.js";

export function appLocale(): AppLocale {
  const locale = getLocale();
  return isAppLocale(locale) ? locale : "en";
}

/** BCP 47 tag for `formatMoneyMinor` / `Intl`. */
export function intlLocale(locale: AppLocale = appLocale()): string {
  return INTL_LOCALE[locale];
}
