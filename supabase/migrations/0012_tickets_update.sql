-- Permite al cliente mover sus propios tickets entre columnas (vista Kanban).
-- Sin esta política, el estado no podía cambiar nunca tras crear el ticket:
-- solo existían políticas de select/insert, ningún update.
create policy "cliente actualiza sus tickets"
  on public.tickets for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
