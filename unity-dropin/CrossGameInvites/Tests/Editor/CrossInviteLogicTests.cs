using System.Collections.Generic;
using NUnit.Framework;

namespace GrudgeMatch.CrossInvites.Tests
{
    public class CrossInviteLogicTests
    {
        static CrossInvite Invite(string status, string app = "lostempires", string id = "a1")
        {
            return new CrossInvite
            {
                id = id,
                app = app,
                app_name = "Lost Empires",
                from_name = "Sam",
                join_url = "https://lost-empires.onrender.com/?room=ABC",
                status = status,
            };
        }

        [Test]
        public void PendingWhileRacing_ShowsCompactWithThreeChoices()
        {
            var n = CrossInviteLogic.Describe(Invite("pending"), racing: true);
            Assert.IsNotNull(n);
            Assert.IsTrue(n.Compact);
            Assert.AreEqual("Sam invites you to Lost Empires", n.Message);
            CollectionAssert.AreEqual(
                new[] { InviteButton.JoinNow, InviteButton.AfterThisGame, InviteButton.NoThanks }, n.Buttons);
        }

        [Test]
        public void PendingInMenus_ShowsJoinAndNoThanks()
        {
            var n = CrossInviteLogic.Describe(Invite("pending"), racing: false);
            Assert.IsNotNull(n);
            Assert.IsFalse(n.Compact);
            Assert.AreEqual("Sam invites you to Lost Empires", n.Message);
            CollectionAssert.AreEqual(new[] { InviteButton.Join, InviteButton.NoThanks }, n.Buttons);
        }

        [Test]
        public void LaterWhileRacing_IsHidden()
        {
            Assert.IsNull(CrossInviteLogic.Describe(Invite("later"), racing: true));
        }

        [Test]
        public void LaterAfterRace_ShowsWaitingMessage()
        {
            var n = CrossInviteLogic.Describe(Invite("later"), racing: false);
            Assert.IsNotNull(n);
            Assert.AreEqual("Sam is waiting for you in Lost Empires", n.Message);
            CollectionAssert.AreEqual(new[] { InviteButton.Join, InviteButton.NoThanks }, n.Buttons);
        }

        [Test]
        public void OwnAppAndOtherStatuses_AreIgnored()
        {
            Assert.IsNull(CrossInviteLogic.Describe(Invite("pending", app: "riotrace"), false));
            Assert.IsNull(CrossInviteLogic.Describe(Invite("pending", app: "RiotRace"), true));
            Assert.IsNull(CrossInviteLogic.Describe(Invite("accepted"), false));
            Assert.IsNull(CrossInviteLogic.Describe(Invite("declined"), false));
            Assert.IsNull(CrossInviteLogic.Describe(null, false));
        }

        [Test]
        public void MissingNames_FallBack()
        {
            var i = Invite("pending");
            i.from_name = "";
            i.app_name = null;
            Assert.AreEqual("A friend invites you to lostempires", CrossInviteLogic.Describe(i, false).Message);
        }

        [Test]
        public void ButtonsMapToChoices()
        {
            Assert.AreEqual(InviteChoice.Now, CrossInviteLogic.ChoiceFor(InviteButton.JoinNow));
            Assert.AreEqual(InviteChoice.Now, CrossInviteLogic.ChoiceFor(InviteButton.Join));
            Assert.AreEqual(InviteChoice.Later, CrossInviteLogic.ChoiceFor(InviteButton.AfterThisGame));
            Assert.AreEqual(InviteChoice.Decline, CrossInviteLogic.ChoiceFor(InviteButton.NoThanks));
            Assert.AreEqual("now", CrossInviteLogic.ToWire(InviteChoice.Now));
            Assert.AreEqual("later", CrossInviteLogic.ToWire(InviteChoice.Later));
            Assert.AreEqual("decline", CrossInviteLogic.ToWire(InviteChoice.Decline));
        }

        [Test]
        public void PickNext_SkipsHandledAndDeferredWhileRacing()
        {
            var list = new List<CrossInvite>
            {
                Invite("pending", id: "x"),
                Invite("later", id: "y"),
                Invite("pending", id: "z"),
            };
            var handled = new HashSet<string> { "x" };
            Assert.AreEqual("z", CrossInviteLogic.PickNext(list, true, handled).id);
            Assert.AreEqual("y", CrossInviteLogic.PickNext(list, false, handled).id);
            Assert.IsNull(CrossInviteLogic.PickNext(new List<CrossInvite>(), false, handled));
        }

        [Test]
        public void OnlyHttpsJoinUrlsAreSafe()
        {
            Assert.IsTrue(CrossInviteLogic.IsSafeJoinUrl("https://lost-empires.onrender.com/?room=ABC"));
            Assert.IsFalse(CrossInviteLogic.IsSafeJoinUrl("http://lost-empires.onrender.com/"));
            Assert.IsFalse(CrossInviteLogic.IsSafeJoinUrl("javascript:alert(1)"));
            Assert.IsFalse(CrossInviteLogic.IsSafeJoinUrl("file:///etc/passwd"));
            Assert.IsFalse(CrossInviteLogic.IsSafeJoinUrl("/relative/path"));
            Assert.IsFalse(CrossInviteLogic.IsSafeJoinUrl(""));
            Assert.IsFalse(CrossInviteLogic.IsSafeJoinUrl(null));
        }

        [Test]
        public void RespondBody_IsTheRpcPayload()
        {
            Assert.AreEqual(
                "{\"p_invite\":\"a1\",\"p_choice\":\"later\",\"p_from_app\":\"riotrace\"}",
                CrossInviteLogic.RespondBody("a1", InviteChoice.Later));
        }

        [Test]
        public void ParseRpcText_UnwrapsJsonString()
        {
            Assert.AreEqual("https://x.example/a?b=1",
                CrossInviteLogic.ParseRpcText("\"https:\\/\\/x.example\\/a?b=1\""));
            Assert.AreEqual("https://x.example/é", CrossInviteLogic.ParseRpcText("\"https://x.example/\\u00e9\""));
            Assert.AreEqual("https://bare.example", CrossInviteLogic.ParseRpcText(" https://bare.example "));
            Assert.IsNull(CrossInviteLogic.ParseRpcText("null"));
            Assert.IsNull(CrossInviteLogic.ParseRpcText(""));
            Assert.IsNull(CrossInviteLogic.ParseRpcText(null));
        }

        [Test]
        public void WrapRows_WrapsArraysForJsonUtility()
        {
            Assert.AreEqual("{\"items\":[{\"id\":\"a\"}]}", CrossInviteLogic.WrapRows("[{\"id\":\"a\"}]"));
            Assert.AreEqual("{\"items\":[]}", CrossInviteLogic.WrapRows(""));
            Assert.AreEqual("{\"items\":[]}", CrossInviteLogic.WrapRows("{\"message\":\"error\"}"));
        }
    }
}
