export abstract class EventConsumer<Event> {
  abstract consume(event: Event): void | Promise<void>;
}
