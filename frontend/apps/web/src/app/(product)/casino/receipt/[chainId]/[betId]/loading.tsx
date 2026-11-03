import { carbonCopyFontVariables } from "../../../../../../features/home/fonts";
import { getRequestI18n } from "../../../../../../i18n/request";

/** While the bet index is read: the printer's slot and a feed bar, no figures. */
export default async function Loading() {
  const { messages } = await getRequestI18n();
  return (
    <div className={carbonCopyFontVariables}>
      <div className="bg-carbon font-text text-body text-paper">
        <div className="mx-auto box-content grid max-w-page grid-cols-1 gap-x-columns gap-y-10 px-gutter pt-12 pb-section lg:grid-cols-12">
          <p role="status" className="text-lede text-on-carbon-muted lg:col-span-5">
            {messages.receipt.page.loading}
          </p>
          <div className="w-full max-w-[480px] lg:col-span-6 lg:col-start-7 lg:justify-self-end">
            <div aria-hidden="true" className="print-slot relative z-10 h-4" />
            <div className="-mt-2 mx-4 overflow-hidden">
              <div className="print-sheet rounded-b-sheet px-5 pt-8 pb-6">
                <div aria-hidden="true" className="print-feed h-3 motion-safe:animate-feed" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
