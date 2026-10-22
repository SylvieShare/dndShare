export async function navigationCaptionMetrics(nav) {
  return nav.getByRole('button').evaluateAll(buttons => buttons.map(button => {
    const label = button.querySelector('.share-icon-navigation__label')
    const style = getComputedStyle(button), range = document.createRange()
    range.selectNodeContents(label)
    return {
      name: button.getAttribute('aria-label'),
      font: parseFloat(getComputedStyle(label).fontSize),
      width: range.getBoundingClientRect().width,
      available: button.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
    }
  }))
}
