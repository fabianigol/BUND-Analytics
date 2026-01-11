/**
 * Detecta el país de una campaña de Meta Ads basándose en su nombre
 * @param campaignName - Nombre de la campaña de Meta Ads
 * @returns 'ES' para España, 'MX' para México
 */
export function detectCampaignCountry(campaignName: string): 'ES' | 'MX' {
  const nameUpper = campaignName.toUpperCase()
  
  // Detectar México
  if (
    nameUpper.includes('CDMX') ||
    nameUpper.includes('MÉXICO') ||
    nameUpper.includes('MEXICO') ||
    nameUpper.includes('_MX') ||
    nameUpper.includes('MX_')
  ) {
    return 'MX'
  }
  
  // Detectar España (ciudades españolas o marcador explícito)
  const spanishCities = [
    'MADRID',
    'BARCELONA',
    'SEVILLA',
    'MÁLAGA',
    'MALAGA',
    'MURCIA',
    'BILBAO',
    'ZARAGOZA',
    'VALENCIA'
  ]
  
  const hasSpanishCity = spanishCities.some(city => nameUpper.includes(city))
  const hasSpainMarker = 
    nameUpper.includes('SPAIN') || 
    nameUpper.includes('_ES') || 
    nameUpper.includes('ES_') || 
    nameUpper.includes('ESPAÑA')
  
  if (hasSpanishCity || hasSpainMarker) {
    return 'ES'
  }
  
  // Por defecto: España (para campañas sin marcador explícito)
  return 'ES'
}

/**
 * Ejemplos de uso:
 * detectCampaignCountry('PRO_Citas_Club_CDMX') // 'MX'
 * detectCampaignCountry('PRO_LP_Black_Friday_25\'_Waitlist_CDMX') // 'MX'
 * detectCampaignCountry('PRO_Leads_Madrid') // 'ES'
 * detectCampaignCountry('Sales_Ecom_Drop_Main - AW25_Spain') // 'ES'
 * detectCampaignCountry('PRO_Citas_Club_Barcelona') // 'ES'
 * detectCampaignCountry('Sales_Ecom_Navidad_2025') // 'ES' (default)
 */
