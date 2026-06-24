// Tipos mínimos que reflejan las entidades de Retell AI que mostraremos en el
// dashboard. Se ampliarán cuando conectemos el proxy real a la API de Retell.

export interface RetellAgent {
  agent_id: string
  agent_name: string | null
  voice_id: string
  language: string
  last_modification_timestamp: number
}

export interface RetellPhoneNumber {
  phone_number: string
  phone_number_pretty: string
  inbound_agent_id: string | null
  outbound_agent_id: string | null
  nickname: string | null
}

export interface RetellCall {
  call_id: string
  agent_id: string
  call_status: 'registered' | 'ongoing' | 'ended' | 'error'
  call_type: 'inbound' | 'outbound' | 'web_call'
  from_number?: string
  to_number?: string
  start_timestamp?: number
  end_timestamp?: number
  duration_ms?: number
  disconnection_reason?: string
  recording_url?: string
  transcript?: string
}
