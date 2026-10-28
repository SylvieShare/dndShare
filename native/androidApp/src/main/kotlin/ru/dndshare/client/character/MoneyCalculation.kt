package ru.dndshare.client.character

import kotlinx.serialization.json.*
import ru.dndshare.client.model.*

const val MAX_WALLET_AMOUNT = 9_007_199_254_740_991L

fun walletAmount(input: JsonObject, key: String): Long {
    val raw = input[key]
    if (raw == null || raw == JsonNull) return 0
    return (raw as? JsonPrimitive)?.content?.toLongOrNull()?.takeIf { it in 0..MAX_WALLET_AMOUNT }
        ?: error("Введите целое неотрицательное количество монет.")
}

fun walletCurrencyIds(money: JsonObject, metadata: HandbookMetadata): List<String> =
    (money["order"].arrayValue().mapNotNull { it.referenceId()?.toString() } +
            metadata.suggests["17"]
                .orEmpty()
                .sortedWith(compareBy<Suggest> { it.id }.thenBy { it.value })
                .map { it.id.toString() })
        .distinct()

fun moneyCalculation(input: JsonObject, currency: String, expression: String, sign: Int): Long {
    require(currency.toLongOrNull()?.let { it > 0 } == true && sign in listOf(-1, 1))
    val amount = arithmeticLongAmount(expression)
    val next = walletAmount(input, currency) + sign * amount
    require(next >= 0) { "Недостаточно монет." }
    require(next <= MAX_WALLET_AMOUNT) { "Слишком большое количество монет." }
    return next
}
