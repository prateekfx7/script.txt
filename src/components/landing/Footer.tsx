import Link from "next/link";

export default function Footer() {
  return (
    <footer className="pt-[70px] pb-10">
      <div className="flex justify-between flex-wrap gap-10 mb-11">
        {/* Brand */}
        <div>
          <Link href="/" className="font-pixel text-[24px] text-indigo leading-none hover:opacity-80 transition-opacity">
            scribe.txt
          </Link>
          <p className="text-[13.5px] text-text-gray-2 mt-2">video to text, in seconds.</p>
        </div>

        {/* Link columns */}
        <div className="flex gap-16 flex-wrap">
          <div>
            <h5 className="font-bold text-[14px] mb-[14px]">product</h5>
            <a href="/#product"  className="block text-[14px] text-text-gray mb-[10px] hover:text-ink transition-colors">features</a>
            <a href="/#how"      className="block text-[14px] text-text-gray mb-[10px] hover:text-ink transition-colors">how it works</a>
            <a href="/#pricing"  className="block text-[14px] text-text-gray mb-[10px] hover:text-ink transition-colors">pricing</a>
          </div>
          <div>
            <h5 className="font-bold text-[14px] mb-[14px]">company</h5>
            <Link href="/about"   className="block text-[14px] text-text-gray mb-[10px] hover:text-ink transition-colors">about</Link>
            <Link href="/contact" className="block text-[14px] text-text-gray mb-[10px] hover:text-ink transition-colors">contact</Link>
          </div>
          <div>
            <h5 className="font-bold text-[14px] mb-[14px]">legal</h5>
            <Link href="/privacy" className="block text-[14px] text-text-gray mb-[10px] hover:text-ink transition-colors">privacy</Link>
            <Link href="/terms"   className="block text-[14px] text-text-gray mb-[10px] hover:text-ink transition-colors">terms</Link>
          </div>
          <div>
            <h5 className="font-bold text-[14px] mb-[14px]">social</h5>
            <a href="https://twitter.com/prateekmaurya77" target="_blank" rel="noreferrer" className="block text-[14px] text-text-gray mb-[10px] hover:text-ink transition-colors">twitter</a>
            <a href="https://instagram.com/prateek.fx"    target="_blank" rel="noreferrer" className="block text-[14px] text-text-gray mb-[10px] hover:text-ink transition-colors">instagram</a>
            <a href="https://github.com/prateekfx7"       target="_blank" rel="noreferrer" className="block text-[14px] text-text-gray mb-[10px] hover:text-ink transition-colors">github</a>
          </div>
        </div>
      </div>

      <hr className="border-none" style={{ borderTop: "1px solid #DDDDDB", marginBottom: 24 }} />

      <div className="flex items-center justify-between flex-wrap gap-3 text-[13px] text-text-gray-2">
        <span>© 2026 scribe.txt · made with love by{" "}
          <a href="https://instagram.com/prateek.fx" target="_blank" rel="noreferrer" className="hover:text-ink transition-colors">@prateek.fx</a>
        </span>
        <div className="flex gap-4">
          <Link href="/privacy" className="hover:text-ink transition-colors">privacy</Link>
          <Link href="/terms"   className="hover:text-ink transition-colors">terms</Link>
        </div>
      </div>
    </footer>
  );
}
