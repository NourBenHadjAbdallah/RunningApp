// services/myeventsService.ts
// Fetches upcoming running events from myevents.tn via a Supabase Edge Function

import { supabase } from './supabase'

export interface Event {
  title: string
  date: string        // "YYYY-MM-DD"
  location: string | null
  image: string | null
  url: string
}

export const myeventsService = {
  async getUpcomingEvents(): Promise<Event[]> {
    const { data, error } = await supabase.functions.invoke('scrape-events')
    if (error) throw error
    return (data as Event[]) ?? []
  },
}