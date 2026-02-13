import { Subject } from "rxjs";
import logger from "../../../helpers/logger";
import { EventConsumer } from "./eventConsumer";

export class EventProvider<Event> {
  private _subject = new Subject<Event>();
  protected logger = logger.child({ _reqId: this.constructor.name });

  registerConsumer(consumer: EventConsumer<Event>): this {
    // this.logger.info("Registering consumer", { consumer: consumer.constructor.name });
    this._subject.subscribe((event) => consumer.consume(event));
    return this;
  }
  publish(event: Event): void {
    // this.logger.info("Publishing event", { event });
    this._subject.next(event);
  }

  // This is a new method that we will use to test the event provider
  // This method will return an observable that we can subscribe to
  // and test the event provider
  getObservable() {
    return this._subject.asObservable();
  }
}
